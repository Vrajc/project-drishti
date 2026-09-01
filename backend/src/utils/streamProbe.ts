import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

// ============================================================================
// Reachability probes for a camera stream.
//
// This is the only thing in the product allowed to decide that a camera is
// ONLINE. It does so by actually opening a socket and speaking the protocol:
// RTSP OPTIONS followed by DESCRIBE, or an HTTP request. Nothing is inferred
// from configuration - a camera that is registered but unreachable reports
// OFFLINE with the reason the operating system gave.
//
// It deliberately does NOT decode video. `fpsObserved` therefore stays null
// here; only a decoder can honestly report a frame rate, and that arrives with
// the stream workers.
// ============================================================================

export type ProbeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export interface ProbeResult {
  status: ProbeStatus;
  /** Total probe time, TCP connect included. Null when nothing ever connected. */
  latencyMs: number | null;
  /** Verbatim reason whenever the status is not ONLINE. Null when it is. */
  error: string | null;
}

export interface ProbeOptions {
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const USER_AGENT = 'Drishti-HealthCheck/1.0';

interface RtspResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/** Maps a socket-level failure onto the sentence an operator needs to read. */
function describeSocketError(error: NodeJS.ErrnoException, host: string, port: number): string {
  switch (error.code) {
    case 'ECONNREFUSED':
      return `Connection refused by ${host}:${port}`;
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Host "${host}" could not be resolved`;
    case 'EHOSTUNREACH':
      return `No route to host ${host}`;
    case 'ENETUNREACH':
      return `Network unreachable while contacting ${host}`;
    case 'ECONNRESET':
      return `${host}:${port} closed the connection during the probe`;
    case 'ETIMEDOUT':
      return `Timed out connecting to ${host}:${port}`;
    default:
      return `${error.code || 'Error'} contacting ${host}:${port}: ${error.message}`;
  }
}

/**
 * Builds an RFC 2617 digest Authorization header. RTSP cameras that require a
 * credential almost always use digest; basic is handled separately.
 */
function digestHeader(
  challenge: string,
  method: string,
  uri: string,
  username: string,
  password: string
): string | null {
  const field = (name: string) => {
    const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(challenge);
    return match ? match[1] : null;
  };

  const realm = field('realm');
  const nonce = field('nonce');
  if (realm === null || nonce === null) return null;

  const md5 = (value: string) => crypto.createHash('md5').update(value).digest('hex');
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = md5(`${ha1}:${nonce}:${ha2}`);

  const opaque = field('opaque');
  return (
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", ` +
    `uri="${uri}", response="${response}"${opaque ? `, opaque="${opaque}"` : ''}`
  );
}

/**
 * Sends one RTSP request on an already-connected socket and resolves with the
 * complete response, body included.
 */
function rtspExchange(
  socket: net.Socket,
  request: string,
  timeoutMs: number
): Promise<RtspResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error(`No RTSP response within ${timeoutMs}ms`))),
      timeoutMs
    );

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('latin1');

      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const rawHeaders = buffer.slice(0, headerEnd);
      const lines = rawHeaders.split('\r\n');
      const statusLine = lines[0] || '';

      const headers: Record<string, string> = {};
      for (const line of lines.slice(1)) {
        const separator = line.indexOf(':');
        if (separator === -1) continue;
        headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }

      const contentLength = Number(headers['content-length'] || 0);
      const body = buffer.slice(headerEnd + 4);
      if (contentLength > 0 && body.length < contentLength) return; // wait for the rest

      const match = /^RTSP\/\d\.\d\s+(\d{3})\s*(.*)$/.exec(statusLine);
      if (!match) {
        finish(() =>
          reject(new Error(`Reply was not RTSP: "${statusLine.slice(0, 80).trim() || '(empty)'}"`))
        );
        return;
      }

      finish(() =>
        resolve({
          statusCode: Number(match[1]),
          statusText: match[2].trim(),
          headers,
          body: body.slice(0, contentLength || body.length),
        })
      );
    };

    const onError = (error: Error) => finish(() => reject(error));
    const onClose = () =>
      finish(() => reject(new Error('The server closed the connection before replying')));

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
    socket.write(request);
  });
}

function connect(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs);

    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
    };

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      socket.destroy();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      socket.destroy();
      const error: NodeJS.ErrnoException = new Error('connect timeout');
      error.code = 'ETIMEDOUT';
      reject(error);
    };

    socket.once('connect', onConnect);
    socket.once('error', onError);
    socket.once('timeout', onTimeout);
  });
}

/**
 * Probes an RTSP endpoint.
 *
 * OPTIONS proves the server is speaking RTSP; DESCRIBE proves *this path* is
 * actually publishing. The distinction matters: MediaMTX answers OPTIONS
 * happily for a path that has no publisher, so checking only OPTIONS would
 * report every dead camera as healthy.
 */
export async function probeRtsp(rawUrl: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { status: 'OFFLINE', latencyMs: null, error: `"${rawUrl}" is not a valid URL` };
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 554;

  // Credentials may be stored on the camera row or embedded in the URL itself.
  const username = options.username || (url.username ? decodeURIComponent(url.username) : null);
  const password = options.password || (url.password ? decodeURIComponent(url.password) : null);

  // The request URI must not carry the credentials.
  const requestUri = `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;

  let socket: net.Socket;
  try {
    socket = await connect(host, port, timeoutMs);
  } catch (error: any) {
    return {
      status: 'OFFLINE',
      latencyMs: null,
      error: describeSocketError(error, host, port),
    };
  }

  const elapsed = () => Date.now() - startedAt;

  try {
    const optionsRequest =
      `OPTIONS ${requestUri} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: ${USER_AGENT}\r\n\r\n`;

    let optionsResponse: RtspResponse;
    try {
      optionsResponse = await rtspExchange(socket, optionsRequest, timeoutMs);
    } catch (error: any) {
      return {
        status: 'OFFLINE',
        latencyMs: elapsed(),
        error: `Connected to ${host}:${port} but OPTIONS failed: ${error.message}`,
      };
    }

    if (optionsResponse.statusCode >= 400 && optionsResponse.statusCode !== 401) {
      return {
        status: 'DEGRADED',
        latencyMs: elapsed(),
        error: `Server answered OPTIONS with ${optionsResponse.statusCode} ${optionsResponse.statusText}`,
      };
    }

    const describeRequest = (authorization?: string) =>
      `DESCRIBE ${requestUri} RTSP/1.0\r\nCSeq: 2\r\nAccept: application/sdp\r\n` +
      `User-Agent: ${USER_AGENT}\r\n${authorization ? `Authorization: ${authorization}\r\n` : ''}\r\n`;

    let describe: RtspResponse;
    try {
      describe = await rtspExchange(socket, describeRequest(), timeoutMs);
    } catch (error: any) {
      return {
        status: 'DEGRADED',
        latencyMs: elapsed(),
        error: `Server answered OPTIONS but DESCRIBE failed: ${error.message}`,
      };
    }

    if (describe.statusCode === 401) {
      const challenge = describe.headers['www-authenticate'] || '';

      if (!username || !password) {
        return {
          status: 'DEGRADED',
          latencyMs: elapsed(),
          error:
            'Stream requires authentication and no credential is stored for this camera. ' +
            'Add a username and password in the registry.',
        };
      }

      const authorization = /digest/i.test(challenge)
        ? digestHeader(challenge, 'DESCRIBE', requestUri, username, password)
        : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

      if (!authorization) {
        return {
          status: 'DEGRADED',
          latencyMs: elapsed(),
          error: `Could not answer the authentication challenge: "${challenge.slice(0, 120)}"`,
        };
      }

      try {
        describe = await rtspExchange(socket, describeRequest(authorization), timeoutMs);
      } catch (error: any) {
        return {
          status: 'DEGRADED',
          latencyMs: elapsed(),
          error: `Authenticated DESCRIBE failed: ${error.message}`,
        };
      }

      if (describe.statusCode === 401) {
        return {
          status: 'DEGRADED',
          latencyMs: elapsed(),
          error: 'The stored credential was rejected by the camera',
        };
      }
    }

    if (describe.statusCode === 404) {
      return {
        status: 'OFFLINE',
        latencyMs: elapsed(),
        error: `${host}:${port} is reachable, but nothing is publishing to "${url.pathname}"`,
      };
    }

    if (describe.statusCode !== 200) {
      return {
        status: 'DEGRADED',
        latencyMs: elapsed(),
        error: `DESCRIBE returned ${describe.statusCode} ${describe.statusText}`,
      };
    }

    if (!/^v=0/m.test(describe.body)) {
      return {
        status: 'DEGRADED',
        latencyMs: elapsed(),
        error: 'DESCRIBE succeeded but returned no session description',
      };
    }

    return { status: 'ONLINE', latencyMs: elapsed(), error: null };
  } finally {
    socket.destroy();
  }
}

/** Probes an HTTP or HTTPS endpoint - MJPEG cameras and ONVIF device services. */
export function probeHttp(rawUrl: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      resolve({ status: 'OFFLINE', latencyMs: null, error: `"${rawUrl}" is not a valid URL` });
      return;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const auth =
      options.username && options.password ? `${options.username}:${options.password}` : undefined;

    let settled = false;
    const settle = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const request = transport.request(
      url,
      { method: 'GET', headers: { 'User-Agent': USER_AGENT }, auth, timeout: timeoutMs },
      (response) => {
        const latencyMs = Date.now() - startedAt;
        const status = response.statusCode ?? 0;

        // Headers are all we need; pulling the body of an MJPEG stream would
        // never finish.
        response.destroy();

        if (status >= 200 && status < 400) {
          settle({ status: 'ONLINE', latencyMs, error: null });
        } else if (status === 401 || status === 403) {
          settle({
            status: 'DEGRADED',
            latencyMs,
            error: auth
              ? 'The stored credential was rejected by the camera'
              : 'Stream requires authentication and no credential is stored for this camera',
          });
        } else if (status === 404) {
          settle({
            status: 'OFFLINE',
            latencyMs,
            error: `${url.host} is reachable, but "${url.pathname}" returned 404`,
          });
        } else {
          settle({
            status: 'DEGRADED',
            latencyMs,
            error: `Camera answered with HTTP ${status}`,
          });
        }
      }
    );

    request.on('timeout', () => {
      request.destroy();
      settle({
        status: 'OFFLINE',
        latencyMs: null,
        error: `No HTTP response from ${url.host} within ${timeoutMs}ms`,
      });
    });

    request.on('error', (error: NodeJS.ErrnoException) => {
      const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
      settle({
        status: 'OFFLINE',
        latencyMs: null,
        error: describeSocketError(error, url.hostname, port),
      });
    });

    request.end();
  });
}

/** Picks the right probe from the URL scheme. */
export async function probeStream(url: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const trimmed = (url || '').trim();

  if (trimmed === '') {
    return {
      status: 'OFFLINE',
      latencyMs: null,
      error: 'No stream URL is configured for this camera',
    };
  }

  if (/^rtsps?:\/\//i.test(trimmed)) return probeRtsp(trimmed, options);
  if (/^https?:\/\//i.test(trimmed)) return probeHttp(trimmed, options);

  return {
    status: 'OFFLINE',
    latencyMs: null,
    error: `Unsupported stream scheme in "${trimmed.slice(0, 60)}" - expected rtsp:// or http://`,
  };
}
