import Redis from 'ioredis';
import prisma from '../lib/prisma.js';
import { emitToEstate, emitToEvent, emitIncident } from '../lib/realtime.js';
import { evaluateCrowdReadings } from './anomalyRules.service.js';

// ============================================================================
// The detection consumer.
//
// This is the join between the analytics engine and the product's own tables:
// it reads the Redis Stream the ai-service publishes to and turns the
// `zoneOccupancy` on each detection into real CrowdDensity rows.
//
// Every number it writes came from a frame. peopleCount is the count the zone
// logic produced from actual detection boxes, confidence is the mean confidence
// of the person detections that made up that count, and timestamp is when the
// frame was sampled. Nothing here fills a gap: if the ai-service stops
// publishing, no rows appear, and the pages that read them show their empty
// state.
// ============================================================================

const STREAM = process.env.DETECTION_STREAM || 'drishti:detections';
const GROUP = process.env.DETECTION_CONSUMER_GROUP || 'drishti-backend';
const CONSUMER = process.env.DETECTION_CONSUMER_NAME || `backend-${process.pid}`;

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config = {
  get enabled() {
    return process.env.DETECTION_CONSUMER_ENABLED !== 'false';
  },
  get redisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  },
  /** How many stream entries to claim per read. */
  get batchSize() {
    return number(process.env.DETECTION_BATCH_SIZE, 200);
  },
  /**
   * Minimum gap between CrowdDensity rows for the same camera and zone.
   *
   * The ai-service samples roughly eight frames a second per camera. Storing a
   * row for every one of them across fifty cameras would be millions of rows a
   * day to draw a chart that changes far more slowly than that. One reading per
   * zone per interval is written, and it is a genuine instantaneous measurement
   * from a real frame rather than an average over the window - so the timestamp
   * on the row is the moment that count was actually observed.
   */
  get writeIntervalSeconds() {
    return number(process.env.DENSITY_WRITE_INTERVAL_SECONDS, 10);
  },
  get reconnectMaxSeconds() {
    return number(process.env.DETECTION_CONSUMER_BACKOFF_MAX, 30);
  },
};

/** One detection as the ai-service publishes it. See ai-service/contracts.py. */
interface DetectionEvent {
  cameraId: string;
  ts: string;
  trackId: number | null;
  class: string;
  confidence: number;
  bbox: number[];
  attributes: Record<string, unknown>;
  zoneOccupancy: Record<string, number>;
  snapshotPath: string | null;
}

interface CameraRow {
  id: string;
  name: string;
  eventId: string | null;
}

interface ZoneRow {
  id: string;
  name: string;
  maxCapacity: number;
  eventId: string | null;
}

export interface ConsumerStats {
  running: boolean;
  connected: boolean;
  entriesRead: number;
  framesAggregated: number;
  densityRowsWritten: number;
  anomaliesRaised: number;
  skippedUnknownCamera: number;
  skippedUnknownZone: number;
  lastEntryAt: string | null;
  lastWriteAt: string | null;
  lastError: string | null;
}

const stats: ConsumerStats = {
  running: false,
  connected: false,
  entriesRead: 0,
  framesAggregated: 0,
  densityRowsWritten: 0,
  anomaliesRaised: 0,
  skippedUnknownCamera: 0,
  skippedUnknownZone: 0,
  lastEntryAt: null,
  lastWriteAt: null,
  lastError: null,
};

export function getConsumerStats(): ConsumerStats {
  return { ...stats };
}

// Registry lookups are cached because a stream entry arrives many times a
// second and the rows change rarely. Short TTL so a re-pointed camera or an
// edited zone capacity is picked up without a restart.
const CACHE_TTL_MS = 30_000;
const cameraCache = new Map<string, { row: CameraRow | null; at: number }>();
const zoneCache = new Map<string, { row: ZoneRow | null; at: number }>();

async function lookupCamera(humanId: string): Promise<CameraRow | null> {
  const cached = cameraCache.get(humanId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.row;

  // The ai-service publishes the human-facing cameraId. Everything written here
  // keys off the UUID, which is what CrowdDensity.cameraId is a foreign key to.
  const row = await prisma.camera.findFirst({
    where: { cameraId: humanId },
    select: { id: true, name: true, eventId: true },
  });

  cameraCache.set(humanId, { row, at: Date.now() });
  return row;
}

async function lookupZone(zoneUuid: string): Promise<ZoneRow | null> {
  const cached = zoneCache.get(zoneUuid);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.row;

  const row = await prisma.zone.findUnique({
    where: { id: zoneUuid },
    select: { id: true, name: true, maxCapacity: true, eventId: true },
  });

  zoneCache.set(zoneUuid, { row, at: Date.now() });
  return row;
}

/** Last write per `${cameraUuid}:${zoneUuid}`, for the throttle. */
const lastWriteAt = new Map<string, number>();

/** UTC time of day, matching CrowdDensity.videoTimestamp's HH:MM:SS format. */
function timeOfDay(when: Date): string {
  return when.toISOString().slice(11, 19);
}

/**
 * One sampled frame's worth of detections, already grouped.
 *
 * Every detection from a frame carries that frame's whole `zoneOccupancy`, so
 * the occupancy is read once per frame rather than once per detection.
 */
interface Frame {
  cameraId: string;
  ts: string;
  zoneOccupancy: Record<string, number>;
  personConfidences: number[];
  snapshotPath: string | null;
}

function groupIntoFrames(events: DetectionEvent[]): Frame[] {
  const frames = new Map<string, Frame>();

  for (const event of events) {
    const key = `${event.cameraId}|${event.ts}`;
    let frame = frames.get(key);
    if (!frame) {
      frame = {
        cameraId: event.cameraId,
        ts: event.ts,
        zoneOccupancy: event.zoneOccupancy || {},
        personConfidences: [],
        snapshotPath: event.snapshotPath ?? null,
      };
      frames.set(key, frame);
    }

    // Only person detections contribute to a crowd count, and only their
    // confidences are averaged into the row's confidence.
    if (event.class === 'person' && Number.isFinite(event.confidence)) {
      frame.personConfidences.push(event.confidence);
    }
  }

  return [...frames.values()];
}

async function writeFrame(frame: Frame): Promise<number> {
  const zoneIds = Object.keys(frame.zoneOccupancy);
  if (zoneIds.length === 0) {
    // The worker could not place boxes in zones, so it published an empty map.
    // There is nothing to record, and an empty map is not a count of zero.
    return 0;
  }

  const camera = await lookupCamera(frame.cameraId);
  if (!camera) {
    stats.skippedUnknownCamera += 1;
    return 0;
  }

  const observedAt = new Date(frame.ts);
  const timestamp = Number.isNaN(observedAt.getTime()) ? new Date() : observedAt;
  const now = Date.now();

  // The mean confidence of the person detections behind this count. Null when
  // the count is zero, because there is nothing to average.
  const confidence =
    frame.personConfidences.length > 0
      ? frame.personConfidences.reduce((a, b) => a + b, 0) / frame.personConfidences.length
      : null;

  const rows: any[] = [];
  const emitted: any[] = [];

  for (const zoneUuid of zoneIds) {
    const throttleKey = `${camera.id}:${zoneUuid}`;
    const previous = lastWriteAt.get(throttleKey) ?? 0;
    if (now - previous < config.writeIntervalSeconds * 1000) continue;

    const zone = await lookupZone(zoneUuid);
    if (!zone) {
      // The worker was started with a zone that no longer exists. Recording it
      // would violate the foreign key; inventing a name would be worse.
      stats.skippedUnknownZone += 1;
      continue;
    }

    const peopleCount = frame.zoneOccupancy[zoneUuid] ?? 0;
    // Over capacity is a real and important reading, so it is not clamped.
    const densityPercentage =
      zone.maxCapacity > 0 ? (peopleCount / zone.maxCapacity) * 100 : 0;

    rows.push({
      eventId: zone.eventId ?? camera.eventId,
      zoneId: zone.id,
      zoneName: zone.name,
      peopleCount,
      densityPercentage,
      timestamp,
      videoTimestamp: timeOfDay(timestamp),
      cameraId: camera.id,
      cameraName: camera.name,
      confidence,
      // frameNumber and processingTime belong to the archived-footage path,
      // where a frame index exists. A live stream has no frame number to give.
      frameNumber: null,
      processingTime: null,
    });

    lastWriteAt.set(throttleKey, now);
    emitted.push({
      eventId: zone.eventId ?? camera.eventId,
      zoneId: zone.id,
      zoneName: zone.name,
      peopleCount,
      densityPercentage,
      maxCapacity: zone.maxCapacity,
      timestamp: timestamp.toISOString(),
      cameraId: camera.id,
      cameraName: camera.name,
      confidence,
      snapshotPath: frame.snapshotPath,
    });
  }

  if (rows.length === 0) return 0;

  let written: Array<{ id: string }>;
  try {
    // createManyAndReturn rather than createMany: the rule engine needs the ids
    // of the readings it is being asked to judge, and re-querying for them would
    // race with the next batch.
    written = await prisma.crowdDensity.createManyAndReturn({ data: rows, select: { id: true } });
  } catch (error: any) {
    stats.lastError = error.message;
    console.error('Detection consumer: could not write density rows:', error.message);
    return 0;
  }

  stats.densityRowsWritten += written.length;
  stats.lastWriteAt = new Date().toISOString();

  for (const reading of emitted) {
    emitToEstate('crowd:density', reading);
    if (reading.eventId) emitToEvent(reading.eventId, 'crowd:density', reading);
  }

  // Every reading is offered to the rule engine as it lands. This is the only
  // path by which ZONE_CAPACITY_BREACH and CROWD_SURGE can fire: both are
  // computed from readings that came out of real frames, so an anomaly here is
  // always backed by a detection someone could go and look at.
  try {
    const raised = await evaluateCrowdReadings(written.map((row) => row.id));
    stats.anomaliesRaised += raised.length;

    for (const incident of raised) {
      emitIncident('incident:new', {
        _id: incident.id,
        id: incident.id,
        eventId: incident.eventId,
        cameraId: incident.cameraId,
        ruleKey: incident.ruleKey,
        severity: incident.severity.toLowerCase(),
        description: incident.description,
        source: 'anomaly',
        status: 'open',
      });
    }
  } catch (error: any) {
    // A rule-engine failure must not cost the density rows that were already
    // written; they are the measurement, the anomaly is a judgement about it.
    stats.lastError = error.message;
    console.error('Detection consumer: anomaly evaluation failed:', error.message);
  }

  return written.length;
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let client: Redis | null = null;
let stopped = false;

async function ensureGroup(redis: Redis): Promise<void> {
  try {
    // MKSTREAM so the group can be created before the ai-service has published
    // anything. '$' means this consumer starts from new entries rather than
    // replaying a backlog of detections describing a scene that has moved on.
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
      const dataIndex = fields.indexOf('data');
      if (dataIndex === -1) continue;
      try {
        events.push(JSON.parse(fields[dataIndex + 1]));
      } catch {
        // A malformed entry is acknowledged and dropped rather than retried
        // forever; it can never become valid.
      }
    }
  }

  stats.entriesRead += ids.length;
  if (ids.length > 0) stats.lastEntryAt = new Date().toISOString();

  const frames = groupIntoFrames(events);
  stats.framesAggregated += frames.length;

  for (const frame of frames) {
    await writeFrame(frame);
  }

  if (ids.length > 0) {
    await redis.xack(STREAM, GROUP, ...ids);
  }
}

export async function startDetectionConsumer(): Promise<void> {
  if (!config.enabled) {
    console.log('🔎 Detection consumer disabled (DETECTION_CONSUMER_ENABLED=false)');
    return;
  }
  if (stats.running) return;

  stats.running = true;
  stopped = false;
  console.log(`🔎 Detection consumer reading ${STREAM} as ${GROUP}/${CONSUMER}`);

  void (async () => {
    let backoff = 1;

    while (!stopped) {
      try {
        if (client === null) {
          client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: null,
            // Reconnection is handled by this loop, so the client should fail
            // fast rather than queueing commands against a dead socket.
            enableOfflineQueue: false,
            lazyConnect: true,
          });
          client.on('error', () => {
            // Logged by the loop below with context; the handler exists so an
            // error event cannot take the process down.
          });
          await client.connect();
          await ensureGroup(client);
          stats.connected = true;
          stats.lastError = null;
          backoff = 1;
          console.log('🔎 Detection consumer connected to Redis');
        }

        await consumeOnce(client);
      } catch (error: any) {
        stats.connected = false;
        stats.lastError = error?.message ?? String(error);

        // Nothing is buffered while Redis is away. Detections produced during
        // the outage are lost, and the charts show the gap - which is honest.
        // Replaying them later as current readings would not be.
        console.warn(
          `🔎 Detection consumer error (${stats.lastError}); retrying in ${backoff}s`
        );

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

export async function stopDetectionConsumer(): Promise<void> {
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
