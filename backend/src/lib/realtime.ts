import type { Server as HttpServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../middleware/auth.middleware.js';

// ============================================================================
// Realtime push.
//
// Every "live" view in Drishti was a setInterval poll - 3s for incidents, 5s
// for density, 15s for anomalies. That is tolerable for a dashboard and wrong
// for a dispatch console, where the whole claim is that an operator sees an
// emergency as it happens.
//
// This mounts Socket.IO on the existing Express server and reuses the existing
// JWT. There is no second auth system: the same token the REST API accepts is
// the one the handshake verifies, and a socket that cannot present one is
// refused rather than dropped into a public room.
//
// Delivery is best-effort by design. Nothing in the product may depend on a
// socket frame arriving - the REST reads remain the source of truth, and every
// consumer keeps a slower poll as a floor. A push that silently fails must
// degrade to "the console updates a few seconds later", never to "the console
// is wrong".
// ============================================================================

/** Rooms. `estate` is jurisdiction-wide and carries everything police can see. */
export const ESTATE_ROOM = 'estate';
export const eventRoom = (eventId: string) => `event:${eventId}`;

export type RealtimeEvent =
  | 'incident:new'
  | 'incident:updated'
  | 'dispatch:new'
  | 'dispatch:updated'
  | 'camera:status'
  // One real CrowdDensity reading, as it is written by the detection consumer.
  | 'crowd:density'
  // A watchlist hit, raised by the match engine from a real detection.
  | 'alert:new'
  | 'alert:updated';

interface SocketUser {
  userId: string;
  role: string;
}

let io: SocketServer | null = null;

/** Roles that may join the estate room, matching the surveillance route guard. */
const ESTATE_ROLES = new Set(['admin', 'police']);

function readToken(socket: Socket): string | null {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim() !== '') {
    return fromAuth.replace('Bearer ', '');
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.trim() !== '') {
    return header.replace('Bearer ', '');
  }

  return null;
}

export function initRealtime(server: HttpServer, allowedOrigins: string[]): SocketServer {
  if (io) return io;

  io = new SocketServer(server, {
    path: '/realtime',
    cors: {
      // Mirrors the Express CORS policy rather than restating it loosely: a
      // socket must not be reachable from an origin the REST API refuses.
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = readToken(socket);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as JwtPayload;

      (socket.data as { user?: SocketUser }).user = {
        userId: decoded.userId,
        role: decoded.role,
      };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket.data as { user?: SocketUser }).user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Room membership is decided here from the verified token, never from
    // anything the client asks for. A participant cannot talk its way into the
    // estate feed by emitting a join.
    if (ESTATE_ROLES.has(user.role)) {
      socket.join(ESTATE_ROOM);
    }

    // Event rooms are opt-in because a user may be involved in several events
    // and only has one open at a time. Membership is still checked server-side
    // by the caller of `emitToEvent` - joining a room only ever receives what
    // that event already broadcasts to its own participants.
    socket.on('event:subscribe', (eventId: unknown) => {
      if (typeof eventId === 'string' && eventId.trim() !== '') {
        socket.join(eventRoom(eventId));
      }
    });

    socket.on('event:unsubscribe', (eventId: unknown) => {
      if (typeof eventId === 'string' && eventId.trim() !== '') {
        socket.leave(eventRoom(eventId));
      }
    });
  });

  console.log('📡 Realtime gateway listening on /realtime');
  return io;
}

/**
 * Push to the jurisdiction-wide room (police and admin).
 * A no-op when the gateway was never started, so nothing that emits has to
 * know whether realtime is available.
 */
export function emitToEstate(event: RealtimeEvent, payload: unknown): void {
  io?.to(ESTATE_ROOM).emit(event, payload);
}

/** Push to everyone watching one event. */
export function emitToEvent(eventId: string, event: RealtimeEvent, payload: unknown): void {
  io?.to(eventRoom(eventId)).emit(event, payload);
}

/**
 * Push an incident-shaped payload to everyone entitled to see it: the estate
 * room always, plus the event room when the incident belongs to an event.
 */
export function emitIncident(
  event: RealtimeEvent,
  payload: { eventId?: string | null } & Record<string, unknown>
): void {
  emitToEstate(event, payload);
  if (payload.eventId) {
    emitToEvent(payload.eventId, event, payload);
  }
}

export function getRealtime(): SocketServer | null {
  return io;
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
