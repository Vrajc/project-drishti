import { CameraStatus, IncidentSeverity, IncidentType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

// ============================================================================
// The anomaly rule engine.
//
// This replaces the alert generator in AnomalyDetection.tsx, which invented a
// type, a location, a description and a 75-100% "confidence" on a 15-second
// coin flip. Every rule here fires on a measurement that already exists in the
// database, and every incident it raises is a real row an operator can act on.
//
// Two rules are live today:
//
//   CAMERA_OFFLINE      - from the health poller's own probe results. A probe
//                         genuinely failed to reach a stream. This is real now,
//                         with no detector involved.
//   ZONE_CAPACITY_BREACH- occupancy over a zone's declared maxCapacity.
//   CROWD_SURGE         - rate of change between two consecutive readings.
//
// The last two are real the moment CrowdDensity rows exist. They are not
// stubbed or back-filled while the table is empty: they simply never
// fire, and the console shows its empty state. An anomaly page with nothing on
// it is the truthful rendering of an estate where nothing has been measured.
//
// Nothing in this file may write an incident that does not correspond to a row
// it read.
// ============================================================================

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const thresholds = {
  /** Occupancy / maxCapacity at which a zone is considered breached. */
  get capacityBreachRatio() {
    return number(process.env.ANOMALY_CAPACITY_RATIO, 0.9);
  },
  /** Fractional rise between consecutive readings that counts as a surge. */
  get surgeRatio() {
    return number(process.env.ANOMALY_SURGE_RATIO, 0.5);
  },
  /** A surge is only meaningful above this many people; below it, noise. */
  get surgeMinPeople() {
    return number(process.env.ANOMALY_SURGE_MIN_PEOPLE, 10);
  },
  /** Two readings further apart than this are not comparable as a rate. */
  get surgeMaxGapSeconds() {
    return number(process.env.ANOMALY_SURGE_MAX_GAP_SECONDS, 300);
  },
};

export type RuleKey = 'CAMERA_OFFLINE' | 'ZONE_CAPACITY_BREACH' | 'CROWD_SURGE';

export interface RaisedIncident {
  id: string;
  ruleKey: RuleKey;
  cameraId: string | null;
  eventId: string | null;
  severity: IncidentSeverity;
  description: string;
}

/**
 * An anomaly incident already open for the same rule and subject is not raised
 * again. Without this, a camera that stays offline would produce one incident
 * every 30 seconds and bury the console within an hour.
 */
async function alreadyOpen(ruleKey: RuleKey, where: Prisma.IncidentWhereInput): Promise<boolean> {
  const existing = await prisma.incident.findFirst({
    where: {
      source: 'ANOMALY',
      ruleKey,
      status: { in: ['OPEN', 'INVESTIGATING'] },
      ...where,
    },
    select: { id: true },
  });

  return existing !== null;
}

interface RaiseInput {
  ruleKey: RuleKey;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  location: string;
  cameraId?: string | null;
  siteId?: string | null;
  eventId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  detectionConfidence?: number | null;
}

async function raise(input: RaiseInput): Promise<RaisedIncident> {
  const incident = await prisma.incident.create({
    data: {
      eventId: input.eventId ?? null,
      cameraId: input.cameraId ?? null,
      siteId: input.siteId ?? null,
      type: input.type,
      severity: input.severity,
      source: 'ANOMALY',
      ruleKey: input.ruleKey,
      description: input.description,
      location: input.location,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      // Machine-raised, so there is no reporter. The database enforces this:
      // incidents_reporter_source_check refuses an ANOMALY row that names one.
      reporter: null,
      reporterEmail: null,
      detectionConfidence: input.detectionConfidence ?? null,
      timestamp: new Date(),
      status: 'OPEN',
    },
    select: { id: true, cameraId: true, eventId: true, severity: true, description: true },
  });

  return { ...incident, ruleKey: input.ruleKey };
}

// ---------------------------------------------------------------------------
// CAMERA_OFFLINE
// ---------------------------------------------------------------------------

export interface HealthTransition {
  id: string;
  cameraId: string;
  from: CameraStatus;
  to: CameraStatus;
  reason?: string | null;
}

/**
 * Raise an incident for each camera the health poller just found unreachable,
 * and resolve the ones that came back.
 *
 * The transition is the evidence: a probe reached this camera on the last sweep
 * and did not on this one. UNKNOWN is deliberately not treated as a fault -
 * "nobody has asked" is not "it is down", which is the same rule the registry
 * map follows when it colours an unprobed camera grey rather than red.
 */
export async function evaluateCameraHealth(
  transitions: HealthTransition[]
): Promise<RaisedIncident[]> {
  const raised: RaisedIncident[] = [];

  const wentDown = transitions.filter((t) => t.to === 'OFFLINE' || t.to === 'DEGRADED');
  const cameBack = transitions.filter((t) => t.to === 'ONLINE');

  for (const transition of wentDown) {
    if (await alreadyOpen('CAMERA_OFFLINE', { cameraId: transition.id })) continue;

    const camera = await prisma.camera.findUnique({
      where: { id: transition.id },
      select: {
        id: true,
        cameraId: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        siteId: true,
        eventId: true,
      },
    });

    if (!camera) continue;

    raised.push(
      await raise({
        ruleKey: 'CAMERA_OFFLINE',
        type: 'GENERAL',
        // A degraded stream still carries pictures; an unreachable one does not.
        severity: transition.to === 'OFFLINE' ? 'HIGH' : 'MEDIUM',
        description:
          `Camera ${camera.cameraId} (${camera.name}) is ${transition.to.toLowerCase()}. ` +
          `Last probe ${transition.reason ? `failed: ${transition.reason}` : 'did not reach the stream'}.`,
        location: camera.location,
        cameraId: camera.id,
        siteId: camera.siteId,
        eventId: camera.eventId,
        latitude: camera.latitude,
        longitude: camera.longitude,
        // A reachability probe is a yes/no answer. There is no confidence to
        // report, so the column stays null rather than carrying a 1.0 that
        // would imply a detector ran.
        detectionConfidence: null,
      })
    );
  }

  // A camera that answers again closes its own incident. The operator did not
  // resolve it, so responseTime is left alone - it measures human response, and
  // attributing a self-healing stream to a responder would corrupt that column.
  for (const transition of cameBack) {
    await prisma.incident.updateMany({
      where: {
        source: 'ANOMALY',
        ruleKey: 'CAMERA_OFFLINE',
        cameraId: transition.id,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  return raised;
}

// ---------------------------------------------------------------------------
// Crowd rules
// ---------------------------------------------------------------------------

/** Severity scales with how far over capacity the zone actually is. */
function severityForRatio(ratio: number): IncidentSeverity {
  if (ratio >= 1.5) return 'CRITICAL';
  if (ratio >= 1.2) return 'HIGH';
  if (ratio >= 1.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Evaluate freshly written crowd readings.
 *
 * Called by whatever produced the rows - the archived-footage analyser today,
 * a live detection consumer later. The rules do not care which, because they
 * read the persisted reading rather than the pipeline that made it.
 */
export async function evaluateCrowdReadings(densityIds: string[]): Promise<RaisedIncident[]> {
  if (densityIds.length === 0) return [];

  const readings = await prisma.crowdDensity.findMany({
    where: { id: { in: densityIds } },
    include: {
      zone: { select: { id: true, name: true, maxCapacity: true } },
      camera: {
        select: { id: true, cameraId: true, location: true, latitude: true, longitude: true, siteId: true },
      },
    },
  });

  const raised: RaisedIncident[] = [];

  for (const reading of readings) {
    const capacity = reading.zone?.maxCapacity;
    const location = reading.camera?.location ?? reading.zoneName;

    // --- ZONE_CAPACITY_BREACH -------------------------------------------
    // Only computable where a capacity was actually declared. A zone with no
    // capacity has nothing to be over.
    if (capacity && capacity > 0) {
      const ratio = reading.peopleCount / capacity;

      if (ratio >= thresholds.capacityBreachRatio) {
        const openAlready = await alreadyOpen('ZONE_CAPACITY_BREACH', {
          OR: [
            ...(reading.zoneId ? [{ description: { contains: reading.zoneName } }] : []),
            ...(reading.cameraId ? [{ cameraId: reading.cameraId }] : []),
          ],
        });

        if (!openAlready) {
          raised.push(
            await raise({
              ruleKey: 'ZONE_CAPACITY_BREACH',
              type: 'SECURITY',
              severity: severityForRatio(ratio),
              description:
                `${reading.zoneName} is at ${reading.peopleCount} people against a declared ` +
                `capacity of ${capacity} (${Math.round(ratio * 100)}%).`,
              location,
              cameraId: reading.cameraId,
              siteId: reading.camera?.siteId ?? null,
              eventId: reading.eventId,
              latitude: reading.camera?.latitude ?? null,
              longitude: reading.camera?.longitude ?? null,
              // The analyser's own confidence for the frame this came from,
              // passed through untouched. Null when it reported none.
              detectionConfidence: reading.confidence,
            })
          );
        }
      }
    }

    // --- CROWD_SURGE ------------------------------------------------------
    // Compared against the previous reading for the same zone. A rate needs two
    // points; the first reading of a zone can never be a surge.
    const previous = await prisma.crowdDensity.findFirst({
      where: {
        zoneId: reading.zoneId,
        zoneName: reading.zoneName,
        timestamp: { lt: reading.timestamp },
        id: { not: reading.id },
      },
      orderBy: { timestamp: 'desc' },
      select: { peopleCount: true, timestamp: true },
    });

    if (!previous || previous.peopleCount < thresholds.surgeMinPeople) continue;

    const gapSeconds = (reading.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    if (gapSeconds <= 0 || gapSeconds > thresholds.surgeMaxGapSeconds) continue;

    const rise = (reading.peopleCount - previous.peopleCount) / previous.peopleCount;
    if (rise < thresholds.surgeRatio) continue;

    if (await alreadyOpen('CROWD_SURGE', { cameraId: reading.cameraId })) continue;

    raised.push(
      await raise({
        ruleKey: 'CROWD_SURGE',
        type: 'SECURITY',
        severity: rise >= 1 ? 'HIGH' : 'MEDIUM',
        description:
          `${reading.zoneName} rose from ${previous.peopleCount} to ${reading.peopleCount} people ` +
          `in ${Math.round(gapSeconds)}s (+${Math.round(rise * 100)}%).`,
        location,
        cameraId: reading.cameraId,
        siteId: reading.camera?.siteId ?? null,
        eventId: reading.eventId,
        latitude: reading.camera?.latitude ?? null,
        longitude: reading.camera?.longitude ?? null,
        detectionConfidence: reading.confidence,
      })
    );
  }

  return raised;
}

/**
 * What the rule engine can currently see, so the UI can explain an empty feed
 * instead of implying nothing is wrong. Every figure is a COUNT.
 */
export async function getAnomalyCoverage() {
  const [camerasProbed, densityReadings, zonesWithCapacity, openAnomalies] = await Promise.all([
    prisma.camera.count({ where: { status: { not: 'UNKNOWN' } } }),
    prisma.crowdDensity.count(),
    prisma.zone.count({ where: { maxCapacity: { gt: 0 } } }),
    prisma.incident.count({ where: { source: 'ANOMALY', status: { in: ['OPEN', 'INVESTIGATING'] } } }),
  ]);

  return {
    camerasProbed,
    densityReadings,
    zonesWithCapacity,
    openAnomalies,
    rules: [
      {
        key: 'CAMERA_OFFLINE',
        // Live as soon as any camera has been probed at all.
        active: camerasProbed > 0,
        requires: 'a completed health probe',
      },
      {
        key: 'ZONE_CAPACITY_BREACH',
        active: densityReadings > 0 && zonesWithCapacity > 0,
        requires: 'crowd readings on a zone with a declared capacity',
      },
      {
        key: 'CROWD_SURGE',
        active: densityReadings > 1,
        requires: 'two or more crowd readings for one zone',
      },
    ],
    thresholds: {
      capacityBreachRatio: thresholds.capacityBreachRatio,
      surgeRatio: thresholds.surgeRatio,
      surgeMinPeople: thresholds.surgeMinPeople,
      surgeMaxGapSeconds: thresholds.surgeMaxGapSeconds,
    },
  };
}
