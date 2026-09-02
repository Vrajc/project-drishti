import { CameraStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { probeStream } from '../utils/streamProbe.js';
import { decryptCredential, isCredentialEncryptionConfigured } from '../utils/credentialCrypto.js';
import { evaluateCameraHealth } from './anomalyRules.service.js';
import { emitIncident } from '../lib/realtime.js';

// ============================================================================
// The camera health poller.
//
// Every CameraHealth row means a probe actually happened. Cameras with no
// stream URL are not probed and get no row - they stay UNKNOWN, which is the
// truthful answer to "is it up?" when nobody has ever asked the question.
//
// Only this module writes Camera.status and Camera.lastSeenAt. The seed never
// touches them, and the registry form cannot set them.
// ============================================================================

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  get enabled() {
    // On by default: a health poller that has to be switched on is a health
    // poller nobody remembers to switch on.
    return process.env.CAMERA_HEALTH_ENABLED !== 'false';
  },
  get intervalMs() {
    return number(process.env.CAMERA_HEALTH_POLL_SECONDS, 30) * 1000;
  },
  get timeoutMs() {
    return number(process.env.CAMERA_HEALTH_TIMEOUT_MS, 5000);
  },
  get concurrency() {
    return Math.min(number(process.env.CAMERA_HEALTH_CONCURRENCY, 16), 64);
  },
  get retentionHours() {
    return number(process.env.CAMERA_HEALTH_RETENTION_HOURS, 24);
  },
};

export interface SweepSummary {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  probed: number;
  skipped: number;
  byStatus: Record<string, number>;
  // `id` is the camera's UUID and `cameraId` its human identifier. The anomaly
  // rule engine needs the former to write a foreign key; the log prints the latter.
  changed: Array<{
    id: string;
    cameraId: string;
    from: CameraStatus;
    to: CameraStatus;
    reason: string | null;
  }>;
  prunedHealthRows: number;
  /** Incidents the rule engine raised from this sweep's transitions. */
  anomaliesRaised: number;
}

interface ProbeTarget {
  id: string;
  cameraId: string;
  rtspUrl: string;
  username: string | null;
  passwordEnc: string | null;
  status: CameraStatus;
}

let sweepInFlight = false;
let timer: NodeJS.Timeout | null = null;
let lastSummary: SweepSummary | null = null;

export function getLastSweepSummary(): SweepSummary | null {
  return lastSummary;
}

/**
 * Recovers the stream password for a camera. A credential that cannot be
 * decrypted is reported rather than silently treated as absent, because
 * "no password" and "the key changed" produce very different probe results
 * and an operator needs to know which one they are looking at.
 */
function resolvePassword(target: ProbeTarget): { password: string | null; problem: string | null } {
  if (!target.passwordEnc) return { password: null, problem: null };

  if (!isCredentialEncryptionConfigured()) {
    return {
      password: null,
      problem:
        'A credential is stored for this camera but CAMERA_CREDENTIAL_KEY is not configured, ' +
        'so it cannot be decrypted',
    };
  }

  try {
    return { password: decryptCredential(target.passwordEnc), problem: null };
  } catch (error: any) {
    return {
      password: null,
      problem: `The stored credential could not be decrypted (${error.message})`,
    };
  }
}

async function probeOne(target: ProbeTarget) {
  const { password, problem } = resolvePassword(target);

  const result = await probeStream(target.rtspUrl, {
    username: target.username,
    password,
    timeoutMs: config.timeoutMs,
  });

  // A decryption problem is worth surfacing even when the probe succeeded
  // anonymously, so it is appended rather than replacing the probe's own reason.
  const error = problem
    ? [result.error, problem].filter(Boolean).join(' — ')
    : result.error;

  return { target, result: { ...result, error: error || null } };
}

/** Runs `worker` over `items` with a fixed number of tasks in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Probes every camera that has a stream URL, writes one CameraHealth row per
 * probe, and updates Camera.status. lastSeenAt moves only on ONLINE - it means
 * "last time we actually reached this camera", not "last time we looked".
 */
export async function runHealthSweep(cameraIds?: string[]): Promise<SweepSummary> {
  const startedAt = new Date();

  const cameras = await prisma.camera.findMany({
    where: cameraIds?.length ? { id: { in: cameraIds } } : undefined,
    select: {
      id: true,
      cameraId: true,
      rtspUrl: true,
      username: true,
      passwordEnc: true,
      status: true,
    },
  });

  const probable = cameras.filter((camera) => (camera.rtspUrl || '').trim() !== '');
  const skipped = cameras.length - probable.length;

  const outcomes = await mapWithConcurrency(probable, config.concurrency, probeOne);

  const byStatus: Record<string, number> = { ONLINE: 0, OFFLINE: 0, DEGRADED: 0 };
  const changed: SweepSummary['changed'] = [];
  const checkedAt = new Date();

  const healthRows: Prisma.CameraHealthCreateManyInput[] = [];
  const idsByStatus = new Map<CameraStatus, string[]>();

  for (const { target, result } of outcomes) {
    const status = result.status as CameraStatus;
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (target.status !== status) {
      changed.push({
        id: target.id,
        cameraId: target.cameraId,
        from: target.status,
        to: status,
        reason: result.error,
      });
    }

    healthRows.push({
      cameraId: target.id,
      checkedAt,
      status,
      latencyMs: result.latencyMs === null ? null : Math.round(result.latencyMs),
      // Left null on purpose. This probe does not decode video, and only a
      // decoder can honestly report a frame rate.
      fpsObserved: null,
      error: result.error,
    });

    const bucket = idsByStatus.get(status);
    if (bucket) bucket.push(target.id);
    else idsByStatus.set(status, [target.id]);
  }

  // The probes themselves take milliseconds; the database round trips do not.
  // Writing one row and one update per camera turned a 1s sweep into a 25s one
  // against a hosted Postgres, so both halves are batched: one insert for the
  // health rows, and one update per distinct status.
  try {
    await prisma.cameraHealth.createMany({ data: healthRows });
  } catch (error: any) {
    // A camera deleted mid-sweep breaks the whole batch on its foreign key.
    // Fall back to row-by-row so one missing camera cannot lose 55 good probes.
    console.warn(`Health sweep: batch insert failed (${error.message}), writing rows individually`);
    for (const row of healthRows) {
      try {
        await prisma.cameraHealth.create({ data: row });
      } catch {
        // The camera is gone. Nothing to record.
      }
    }
  }

  for (const [status, ids] of idsByStatus) {
    try {
      await prisma.camera.updateMany({
        where: { id: { in: ids } },
        // lastSeenAt means "last time we actually reached it", so it moves only
        // on ONLINE. updateMany ignores ids that no longer exist.
        data: { status, ...(status === 'ONLINE' ? { lastSeenAt: checkedAt } : {}) },
      });
    } catch (error: any) {
      console.error(`Health sweep: could not set ${ids.length} camera(s) to ${status}:`, error.message);
    }
  }

  // One row per camera every 30s adds up fast, and old probes stop being
  // interesting once the flapping history has scrolled past.
  let prunedHealthRows = 0;
  try {
    const cutoff = new Date(Date.now() - config.retentionHours * 3600 * 1000);
    const pruned = await prisma.cameraHealth.deleteMany({ where: { checkedAt: { lt: cutoff } } });
    prunedHealthRows = pruned.count;
  } catch (error: any) {
    console.error('Health sweep: pruning old health rows failed:', error.message);
  }

  // A status transition is the only evidence of a camera fault this system has,
  // and it is real: a probe reached the stream last sweep and did not this one.
  // Turning it into an incident is what puts a genuine anomaly in front of a
  // police operator without any detector being involved.
  let anomaliesRaised = 0;
  if (changed.length > 0) {
    try {
      const raised = await evaluateCameraHealth(changed);
      anomaliesRaised = raised.length;

      for (const incident of raised) {
        emitIncident('incident:new', {
          _id: incident.id,
          id: incident.id,
          eventId: incident.eventId,
          cameraId: incident.cameraId,
          ruleKey: incident.ruleKey,
          severity: incident.severity?.toLowerCase() ?? null,
          description: incident.description,
          source: 'anomaly',
          status: 'open',
        });
      }
    } catch (error: any) {
      // A failure to raise the incident must not lose the health data that was
      // already written - the probe results are the more important record.
      console.error('📷 Anomaly rules failed on health transitions:', error.message);
    }
  }

  const finishedAt = new Date();
  const summary: SweepSummary = {
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    probed: probable.length,
    skipped,
    byStatus,
    changed,
    prunedHealthRows,
    anomaliesRaised,
  };

  lastSummary = summary;
  return summary;
}

export function startHealthPoller(): void {
  if (!config.enabled) {
    console.log('📷 Camera health poller disabled (CAMERA_HEALTH_ENABLED=false)');
    return;
  }

  if (timer) return;

  const intervalSeconds = Math.round(config.intervalMs / 1000);
  console.log(
    `📷 Camera health poller every ${intervalSeconds}s ` +
      `(timeout ${config.timeoutMs}ms, ${config.concurrency} at a time)`
  );

  const tick = async () => {
    // A sweep that overruns its interval must not stack up behind itself.
    if (sweepInFlight) {
      console.warn('📷 Health sweep still running, skipping this tick');
      return;
    }

    sweepInFlight = true;
    try {
      const summary = await runHealthSweep();
      const parts = Object.entries(summary.byStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => `${count} ${status.toLowerCase()}`)
        .join(', ');

      console.log(
        `📷 Health sweep: ${summary.probed} probed in ${summary.durationMs}ms` +
          `${parts ? ` — ${parts}` : ''}` +
          `${summary.skipped ? ` (${summary.skipped} without a stream URL, not probed)` : ''}`
      );

      if (summary.durationMs > config.intervalMs) {
        console.warn(
          `📷 That sweep took longer than the ${Math.round(config.intervalMs / 1000)}s poll ` +
            'interval, so ticks are being skipped. Raise CAMERA_HEALTH_CONCURRENCY, lower ' +
            'CAMERA_HEALTH_TIMEOUT_MS, or lengthen CAMERA_HEALTH_POLL_SECONDS.'
        );
      }

      if (summary.anomaliesRaised > 0) {
        console.log(`   ${summary.anomaliesRaised} anomaly incident(s) raised from those transitions`);
      }

      for (const change of summary.changed) {
        console.log(`   ${change.cameraId}: ${change.from} → ${change.to}${change.reason ? ` — ${change.reason}` : ''}`);
      }
    } catch (error: any) {
      // The poller must survive a database blip; the next tick tries again.
      console.error('📷 Health sweep failed:', error.message);
    } finally {
      sweepInFlight = false;
    }
  };

  timer = setInterval(tick, config.intervalMs);
  // Never hold the process open just for the poller.
  timer.unref?.();

  // Probe once at startup so the registry is not stale for the first interval.
  void tick();
}

export function stopHealthPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
