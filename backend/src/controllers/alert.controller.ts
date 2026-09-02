import { Response } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { emitToEstate } from '../lib/realtime.js';
import { getMatchEngineStats } from '../services/matchEngine.service.js';

// The alerts console.
//
// Every alert here was raised by the match engine from a real detection, and
// carries the detection that caused it - snapshot path, camera, bounding box and
// the plate as it was actually read. An operator can therefore check the machine
// rather than take its word.

const STATUSES = ['NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'CLOSED', 'FALSE_POSITIVE'] as const;
type AlertStatus = (typeof STATUSES)[number];

const alertInclude = {
  watchlistEntry: {
    select: {
      id: true,
      plateNumber: true,
      vehicleMakeModel: true,
      color: true,
      personName: true,
      caseNumber: true,
      caseType: true,
      severity: true,
      notes: true,
    },
  },
  detection: {
    select: {
      id: true,
      plateNumber: true,
      plateConfidence: true,
      objectClass: true,
      vehicleType: true,
      color: true,
      confidence: true,
      bbox: true,
      snapshotPath: true,
      ts: true,
      trackId: true,
    },
  },
  camera: {
    select: { id: true, cameraId: true, name: true, location: true, latitude: true, longitude: true },
  },
  acknowledger: { select: { id: true, name: true } },
} as const;

function fail(res: Response, error: any, fallback: string) {
  if (error?.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

export const listAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const { status, cameraId, watchlistEntryId } = req.query;
    const take = Math.min(Math.max(Number(req.query.take) || 100, 1), 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const where: any = {};
    if (status) {
      const wanted = String(status).toUpperCase();
      if (!STATUSES.includes(wanted as AlertStatus)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of ${STATUSES.join(', ')}`,
        });
      }
      where.status = wanted;
    }
    if (cameraId) where.cameraId = String(cameraId);
    if (watchlistEntryId) where.watchlistEntryId = String(watchlistEntryId);

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({ where, include: alertInclude, orderBy: { ts: 'desc' }, skip, take }),
      prisma.alert.count({ where }),
    ]);

    res.status(200).json({ success: true, data: alerts, total, skip, take });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch alerts');
  }
};

/**
 * Counts for the navbar badge, plus enough about the engine to explain a zero.
 *
 * A console showing "0 alerts" means one of two very different things: nothing
 * matched, or nothing is being read. `engine` is what tells them apart, so the
 * UI never presents an idle pipeline as a quiet night.
 */
export const getAlertCounts = async (_req: AuthRequest, res: Response) => {
  try {
    const [byStatus, total, watchlistActive, platesReadable] = await Promise.all([
      prisma.alert.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.alert.count(),
      prisma.watchlistEntry.count({ where: { isActive: true } }),
      // Detections that actually carried a plate. Zero here means no plate
      // reader is running, which is why there are no alerts.
      prisma.detection.count({ where: { plateNormalised: { not: null } } }),
    ]);

    const counts: Record<string, number> = {};
    for (const status of STATUSES) counts[status] = 0;
    for (const row of byStatus) counts[row.status] = row._count._all;

    res.status(200).json({
      success: true,
      data: {
        total,
        byStatus: counts,
        // What the navbar badge shows: alerts nobody has looked at yet.
        unhandled: counts.NEW,
        watchlistActive,
        platesReadable,
        engine: getMatchEngineStats(),
      },
    });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch alert counts');
  }
};

/**
 * Moves an alert through the console's workflow.
 *
 * `acknowledgedBy` is taken from the verified token and stamped the first time
 * a human touches the alert. It is never overwritten afterwards: the audit trail
 * records who first took responsibility, not who most recently clicked.
 */
export const updateAlertStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const wanted = String(req.body?.status || '').toUpperCase();
    if (!STATUSES.includes(wanted as AlertStatus)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of ${STATUSES.join(', ')}`,
      });
    }

    const existing = await prisma.alert.findUnique({
      where: { id: req.params.id },
      select: { id: true, acknowledgedBy: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Alert not found' });

    const notes = req.body?.notes === undefined ? undefined : String(req.body.notes).trim() || null;

    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: wanted as AlertStatus,
        ...(notes === undefined ? {} : { notes }),
        ...(existing.acknowledgedBy
          ? {}
          : { acknowledgedBy: userId, acknowledgedAt: new Date() }),
      },
      include: alertInclude,
    });

    emitToEstate('alert:updated', {
      id: alert.id,
      status: alert.status.toLowerCase(),
      acknowledgedBy: alert.acknowledger?.name ?? null,
      acknowledgedAt: alert.acknowledgedAt,
    });

    res.status(200).json({ success: true, data: alert });
  } catch (error: any) {
    fail(res, error, 'Failed to update the alert');
  }
};
