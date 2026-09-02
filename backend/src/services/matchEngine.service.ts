import Redis from 'ioredis';
import prisma from '../lib/prisma.js';
import { emitToEstate } from '../lib/realtime.js';
import { matchPlate, normalisePlate } from '../utils/plateMatch.js';

// ============================================================================
// The match engine.
//
// Reads the same detection stream as the crowd-density consumer, but under its
// own consumer group, so the two have independent delivery and neither can stop
// the other. Its job is three things:
//
//   1. persist a sampled subset of detections (see the sampling rule below);
//   2. record a track point per camera sighting, for cross-camera routes;
//   3. compare every plate it sees against the active watchlist, and raise a
//      real Alert when one matches.
//
// Every match score in the alerts table was computed by `matchPlate` from the
// edit distance between two normalised plates. None is assigned.
//
// If the ai-service is not reading plates - which it is not unless a plate
// detector is configured - this engine sees no plate text and raises no alerts.
// That is the correct behaviour, and the console says so rather than looking
// broken.
// ============================================================================

const STREAM = process.env.DETECTION_STREAM || 'drishti:detections';
const GROUP = process.env.MATCH_CONSUMER_GROUP || 'drishti-match';
const CONSUMER = process.env.MATCH_CONSUMER_NAME || `match-${process.pid}`;

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config = {
  get enabled() {
    return process.env.MATCH_ENGINE_ENABLED !== 'false';
  },
  get redisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  },
  get batchSize() {
    return number(process.env.MATCH_BATCH_SIZE, 200);
  },
  /**
   * One detection row per camera-track per this many seconds. See the note on
   * the Detection model: the table is a sample, not a complete record, and the
   * rule is stated wherever it is served.
   */
  get persistIntervalSeconds() {
    return number(process.env.DETECTION_PERSIST_INTERVAL_SECONDS, 10);
  },
  /** One track point per camera-track per this many seconds. */
  get trackPointIntervalSeconds() {
    return number(process.env.TRACKPOINT_INTERVAL_SECONDS, 5);
  },
  /**
   * The same plate seen again on the same camera inside this window is the same
   * vehicle still in view, not a second sighting. Without it, a car waiting at a
   * red light would raise an alert on every sampled frame.
   */
  get alertDedupeSeconds() {
    return number(process.env.ALERT_DEDUPE_SECONDS, 30);
  },
  /** Maximum edit distance still treated as a probable match. */
  get fuzzyDistance() {
    return number(process.env.PLATE_FUZZY_DISTANCE, 1);
  },
  get reconnectMaxSeconds() {
    return number(process.env.MATCH_ENGINE_BACKOFF_MAX, 30);
  },
};

interface DetectionEvent {
  cameraId: string;
  ts: string;
  trackId: number | null;
  class: string;
  confidence: number;
  bbox: number[];
  attributes: {
    plateText?: string | null;
    plateConfidence?: number | null;
    color?: string | null;
    vehicleType?: string | null;
  };
  zoneOccupancy: Record<string, number>;
  snapshotPath: string | null;
}

export type { DetectionEvent };

export interface MatchEngineStats {
  running: boolean;
  connected: boolean;
  entriesRead: number;
  detectionsPersisted: number;
  trackPointsWritten: number;
  platesSeen: number;
  alertsRaised: number;
  alertsSuppressedAsDuplicate: number;
  lastAlertAt: string | null;
  lastError: string | null;
}

const stats: MatchEngineStats = {
  running: false,
  connected: false,
  entriesRead: 0,
  detectionsPersisted: 0,
  trackPointsWritten: 0,
  platesSeen: 0,
  alertsRaised: 0,
  alertsSuppressedAsDuplicate: 0,
  lastAlertAt: null,
  lastError: null,
};

export function getMatchEngineStats(): MatchEngineStats {
  return { ...stats };
}

// --- caches ----------------------------------------------------------------

interface CameraRow {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

const CAMERA_TTL_MS = 30_000;
const cameraCache = new Map<string, { row: CameraRow | null; at: number }>();

async function lookupCamera(humanId: string): Promise<CameraRow | null> {
  const cached = cameraCache.get(humanId);
  if (cached && Date.now() - cached.at < CAMERA_TTL_MS) return cached.row;

  const row = await prisma.camera.findFirst({
    where: { cameraId: humanId },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  cameraCache.set(humanId, { row, at: Date.now() });
  return row;
}

interface WatchRow {
  id: string;
  plateNormalised: string;
  plateNumber: string | null;
  severity: string;
  caseNumber: string;
}

/**
 * Active vehicle entries, refreshed periodically.
 *
 * A short TTL is the point: an operator who adds a plate expects it to be live
 * within seconds, and the phase's own acceptance test depends on it.
 */
const WATCHLIST_TTL_MS = number(process.env.WATCHLIST_CACHE_MS, 5000);
let watchlistCache: { rows: WatchRow[]; at: number } | null = null;

async function activeVehicleWatchlist(): Promise<WatchRow[]> {
  if (watchlistCache && Date.now() - watchlistCache.at < WATCHLIST_TTL_MS) {
    return watchlistCache.rows;
  }

  const now = new Date();
  const rows = await prisma.watchlistEntry.findMany({
    where: {
      isActive: true,
      entityType: 'VEHICLE',
      plateNormalised: { not: null },
      // An expired entry is not a live one. Comparing against it would raise an
      // alert for a case that has been closed.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, plateNormalised: true, plateNumber: true, severity: true, caseNumber: true },
  });

  watchlistCache = {
    rows: rows.map((row) => ({ ...row, plateNormalised: row.plateNormalised as string })),
    at: Date.now(),
  };
  return watchlistCache.rows;
}

/** Called by the watchlist routes so a new entry is live immediately. */
export function invalidateWatchlistCache(): void {
  watchlistCache = null;
}

// --- throttles -------------------------------------------------------------

const lastPersistAt = new Map<string, number>();
const lastTrackPointAt = new Map<string, number>();

/**
 * Bounded so a long-running process cannot grow these maps without limit as
 * track ids churn. Oldest entries go first; the cost of dropping one is a single
 * extra row.
 */
function remember(map: Map<string, number>, key: string, at: number, cap = 20_000) {
  map.set(key, at);
  if (map.size > cap) {
    const excess = map.size - cap;
    let removed = 0;
    for (const existing of map.keys()) {
      map.delete(existing);
      if (++removed >= excess) break;
    }
  }
}

// --- processing ------------------------------------------------------------

/**
 * The engine's single unit of work: one detection in, rows and alerts out.
 *
 * Exported because the stream loop is only one way to drive it - a replay of
 * archived detections, or a check that a given plate would fire, needs the same
 * path rather than a parallel one that could drift from it.
 */
export async function processDetectionEvent(event: DetectionEvent): Promise<void> {
  const camera = await lookupCamera(event.cameraId);
  if (!camera) return;

  const observed = new Date(event.ts);
  const ts = Number.isNaN(observed.getTime()) ? new Date() : observed;
  const now = Date.now();

  const plateText = event.attributes?.plateText ?? null;
  const plateNormalised = normalisePlate(plateText);
  if (plateNormalised) stats.platesSeen += 1;

  const trackKey = `${camera.id}:${event.trackId ?? 'untracked'}`;

  // A detection carrying a plate is always persisted: it is evidence, and it is
  // what a watchlist alert and a vehicle route are built from. Everything else
  // is sampled per track.
  const dueForPersist =
    plateNormalised !== null ||
    now - (lastPersistAt.get(trackKey) ?? 0) >= config.persistIntervalSeconds * 1000;

  let detectionId: string | null = null;

  if (dueForPersist) {
    try {
      const row = await prisma.detection.create({
        data: {
          cameraId: camera.id,
          trackId: event.trackId,
          objectClass: event.class,
          confidence: event.confidence,
          bbox: event.bbox,
          plateNumber: plateText,
          plateNormalised,
          plateConfidence: event.attributes?.plateConfidence ?? null,
          color: event.attributes?.color ?? null,
          vehicleType: event.attributes?.vehicleType ?? null,
          snapshotPath: event.snapshotPath,
          ts,
        },
        select: { id: true },
      });
      detectionId = row.id;
      stats.detectionsPersisted += 1;
      remember(lastPersistAt, trackKey, now);
    } catch (error: any) {
      stats.lastError = error.message;
      return;
    }
  }

  // A track point needs a surveyed camera. Without coordinates there is no
  // point to place, and putting one at 0,0 would draw a route through the Gulf
  // of Guinea.
  if (
    event.trackId !== null &&
    camera.latitude !== null &&
    camera.longitude !== null &&
    now - (lastTrackPointAt.get(trackKey) ?? 0) >= config.trackPointIntervalSeconds * 1000
  ) {
    try {
      await prisma.trackPoint.create({
        data: {
          cameraId: camera.id,
          trackId: event.trackId,
          ts,
          lat: camera.latitude,
          lng: camera.longitude,
          plateNormalised,
          plateNumber: plateText,
          objectClass: event.class,
        },
      });
      stats.trackPointsWritten += 1;
      remember(lastTrackPointAt, trackKey, now);
    } catch (error: any) {
      stats.lastError = error.message;
    }
  }

  if (!plateNormalised || !detectionId) return;

  await raiseAlerts(plateNormalised, detectionId, camera, ts);
}

async function raiseAlerts(
  plateNormalised: string,
  detectionId: string,
  camera: CameraRow,
  ts: Date
): Promise<void> {
  const watchlist = await activeVehicleWatchlist();
  if (watchlist.length === 0) return;

  for (const entry of watchlist) {
    const match = matchPlate(plateNormalised, entry.plateNormalised, {
      fuzzyDistance: config.fuzzyDistance,
    });
    if (!match) continue;

    // The same vehicle still in view on the same camera is one sighting, not
    // one per sampled frame.
    const since = new Date(ts.getTime() - config.alertDedupeSeconds * 1000);
    const duplicate = await prisma.alert.findFirst({
      where: { watchlistEntryId: entry.id, cameraId: camera.id, ts: { gte: since } },
      select: { id: true },
    });

    if (duplicate) {
      stats.alertsSuppressedAsDuplicate += 1;
      continue;
    }

    try {
      const alert = await prisma.alert.create({
        data: {
          watchlistEntryId: entry.id,
          detectionId,
          cameraId: camera.id,
          matchType: match.matchType,
          // Computed by matchPlate from the edit distance. Never assigned.
          matchScore: match.score,
          ts,
        },
        select: { id: true, ts: true },
      });

      stats.alertsRaised += 1;
      stats.lastAlertAt = new Date().toISOString();

      emitToEstate('alert:new', {
        id: alert.id,
        watchlistEntryId: entry.id,
        caseNumber: entry.caseNumber,
        plateNumber: entry.plateNumber,
        detectionId,
        cameraId: camera.id,
        cameraName: camera.name,
        matchType: match.matchType,
        matchScore: match.score,
        editDistance: match.distance,
        severity: String(entry.severity).toLowerCase(),
        ts: alert.ts.toISOString(),
        status: 'new',
      });
    } catch (error: any) {
      stats.lastError = error.message;
    }
  }
}

// --- the loop --------------------------------------------------------------

let client: Redis | null = null;
let stopped = false;

async function ensureGroup(redis: Redis): Promise<void> {
  try {
    // '$' so the engine starts from new detections. Replaying a backlog would
    // raise alerts for vehicles that passed hours ago as though they were
    // passing now.
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
  } catch (error: any) {
    if (!String(error?.message || '').includes('BUSYGROUP')) throw error;
  }
}

async function consumeOnce(redis: Redis): Promise<void> {
  const response = (await redis.xreadgroup(
    'GROUP',
    GROUP,
    CONSUMER,
    'COUNT',
    config.batchSize,
    'BLOCK',
    5000,
    'STREAMS',
    STREAM,
    '>'
  )) as Array<[string, Array<[string, string[]]>]> | null;

  if (!response || response.length === 0) return;

  const ids: string[] = [];
  const events: DetectionEvent[] = [];

  for (const [, entries] of response) {
    for (const [id, fields] of entries) {
      ids.push(id);
      const index = fields.indexOf('data');
      if (index === -1) continue;
      try {
        events.push(JSON.parse(fields[index + 1]));
      } catch {
        // Malformed entries are acknowledged and dropped; they cannot become
        // valid on a retry.
      }
    }
  }

  stats.entriesRead += ids.length;

  for (const event of events) {
    try {
      await processDetectionEvent(event);
    } catch (error: any) {
      stats.lastError = error?.message ?? String(error);
    }
  }

  if (ids.length > 0) await redis.xack(STREAM, GROUP, ...ids);
}

export async function startMatchEngine(): Promise<void> {
  if (!config.enabled) {
    console.log('🎯 Match engine disabled (MATCH_ENGINE_ENABLED=false)');
    return;
  }
  if (stats.running) return;

  stats.running = true;
  stopped = false;
  console.log(`🎯 Match engine reading ${STREAM} as ${GROUP}/${CONSUMER}`);

  void (async () => {
    let backoff = 1;

    while (!stopped) {
      try {
        if (client === null) {
          client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            lazyConnect: true,
          });
          client.on('error', () => {
            // Reported by the loop with context.
          });
          await client.connect();
          await ensureGroup(client);
          stats.connected = true;
          stats.lastError = null;
          backoff = 1;
          console.log('🎯 Match engine connected to Redis');
        }

        await consumeOnce(client);
      } catch (error: any) {
        stats.connected = false;
        stats.lastError = error?.message ?? String(error);
        console.warn(`🎯 Match engine error (${stats.lastError}); retrying in ${backoff}s`);

        try {
          client?.disconnect();
        } catch {
          /* already gone */
        }
        client = null;

        await new Promise((resolve) => setTimeout(resolve, backoff * 1000));
        backoff = Math.min(backoff * 2, config.reconnectMaxSeconds);
      }
    }

    stats.running = false;
    stats.connected = false;
  })();
}

export async function stopMatchEngine(): Promise<void> {
  stopped = true;
  if (client) {
    try {
      client.disconnect();
    } catch {
      /* already gone */
    }
    client = null;
  }
  stats.running = false;
  stats.connected = false;
}
