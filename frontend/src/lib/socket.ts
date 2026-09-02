import { io, type Socket } from 'socket.io-client';

// ============================================================================
// Realtime client.
//
// One shared socket for the whole app, authenticated with the same JWT the REST
// calls already send. It carries pushes for incidents and dispatch so a police
// operator sees an emergency when it happens rather than up to a poll interval
// later.
//
// The contract every consumer must honour: a push is an optimisation, never the
// source of truth. Pages keep their existing REST read and their existing
// (slower) poll as a floor, and treat a frame as "refresh now". If the socket
// never connects, the console degrades to exactly the behaviour it had before -
// correct, just a few seconds behind - and says so in its status line.
// ============================================================================

const RAW_API = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
// The gateway is mounted on the API server itself, at /realtime, so strip the
// trailing /api to get the origin.
const SOCKET_ORIGIN = RAW_API.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Returns the shared socket, connecting it on first use. Returns null when
 * there is no token — an unauthenticated socket is refused by the server, and
 * retrying it in a loop would be noise.
 */
export function getSocket(): Socket | null {
  const token = localStorage.getItem('drishti_token');
  if (!token) return null;

  if (socket) return socket;

  socket = io(SOCKET_ORIGIN, {
    path: '/realtime',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribes to one event name for the lifetime of a component.
 * Returns an unsubscribe function; call it from the effect's cleanup.
 */
export function onRealtime(
  event: string,
  handler: (payload: any) => void
): () => void {
  const active = getSocket();
  if (!active) return () => undefined;

  active.on(event, handler);
  return () => {
    active.off(event, handler);
  };
}
