import { Response } from 'express';
import prisma from '../lib/prisma.js';
import crowdAnalysisService from '../services/crowdAnalysis.service.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

// Live monitoring aggregations for one event.
//
// These routes were previously placeholders that answered with a fixed string.
// They now answer with queries, and every figure below traces to a row: zone occupancy comes from
// CrowdDensity written by the detection consumer, camera state from the health
// poller's probes, and incident counts from the incidents table.
//
// Where nothing has been recorded yet the answer is null or an empty list, never
// a zero standing in for "we have not looked".

async function loadEvent(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      location: true,
      crowdSize: true,
      zones: { select: { id: true, zoneId: true, name: true, maxCapacity: true } },
      cameras: {
        select: {
          id: true,
          cameraId: true,
          name: true,
          status: true,
          lastSeenAt: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
}

/**
 * Everything the live monitoring page needs, in one query set.
 *
 * `latestReading` is null for a zone nothing has measured yet - that is what the
 * page shows as "Awaiting first reading" rather than a zero.
 */
export const getLiveMonitoring = async (req: AuthRequest, res: Response) => {
  try {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const zoneIds = event.zones.map((zone) => zone.id);

    // One latest reading per zone. Done per zone rather than as one query so a
    // zone with no readings is absent rather than silently folded into another.
    const latestByZone = await Promise.all(
      zoneIds.map((zoneId) =>
        prisma.crowdDensity.findFirst({
          where: { zoneId },
          orderBy: { timestamp: 'desc' },
          select: {
            peopleCount: true,
            densityPercentage: true,
            timestamp: true,
            cameraName: true,
            confidence: true,
          },
        })
      )
    );

    const [openIncidents, investigatingIncidents, resolvedIncidents, recentIncidents] =
      await Promise.all([
        prisma.incident.count({ where: { eventId: event.id, status: 'OPEN' } }),
        prisma.incident.count({ where: { eventId: event.id, status: 'INVESTIGATING' } }),
        prisma.incident.count({ where: { eventId: event.id, status: 'RESOLVED' } }),
        prisma.incident.findMany({
          where: { eventId: event.id },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            severity: true,
            source: true,
            status: true,
            description: true,
            location: true,
            timestamp: true,
          },
        }),
      ]);

    // Mean over incidents that were genuinely resolved and have a recorded
    // response time. Null when there are none - not zero, which would read as
    // "instant".
    const resolved = await prisma.incident.findMany({
      where: { eventId: event.id, status: 'RESOLVED', responseTime: { not: null } },
      select: { responseTime: true },
    });
    const meanResponseSeconds =
      resolved.length > 0
        ? resolved.reduce((sum, row) => sum + (row.responseTime ?? 0), 0) / resolved.length
        : null;

    const cameraStatusCounts = event.cameras.reduce<Record<string, number>>((counts, camera) => {
      counts[camera.status] = (counts[camera.status] ?? 0) + 1;
      return counts;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        event: { id: event.id, name: event.name, location: event.location, crowdSize: event.crowdSize },
        zones: event.zones.map((zone, index) => ({
          id: zone.id,
          zoneId: zone.zoneId,
          name: zone.name,
          maxCapacity: zone.maxCapacity,
          latestReading: latestByZone[index]
            ? {
                peopleCount: latestByZone[index]!.peopleCount,
                densityPercentage: latestByZone[index]!.densityPercentage,
                observedAt: latestByZone[index]!.timestamp,
                cameraName: latestByZone[index]!.cameraName,
                confidence: latestByZone[index]!.confidence,
              }
            : null,
        })),
        cameras: event.cameras,
        cameraStatusCounts,
        incidents: {
          open: openIncidents,
          investigating: investigatingIncidents,
          resolved: resolvedIncidents,
          total: openIncidents + investigatingIncidents + resolvedIncidents,
          meanResponseSeconds,
          recent: recentIncidents,
        },
      },
    });
  } catch (error: any) {
    console.error('Live monitoring error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load live monitoring' });
  }
};

/** Density readings over a window, for the crowd flow charts. */
export const getCrowdFlow = async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const hours = Math.min(Math.max(Number(req.query.hours) || 6, 1), 168);
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const readings = await prisma.crowdDensity.findMany({
      where: { eventId: event.id, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      select: {
        zoneId: true,
        zoneName: true,
        peopleCount: true,
        densityPercentage: true,
        timestamp: true,
        cameraName: true,
        confidence: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        windowHours: hours,
        // An empty list means nothing has been measured in this window. The
        // charts render that as an empty state, not a flat line at zero.
        readings,
        latestByZone: await crowdAnalysisService.getLatestDensityByZone(event.id),
      },
    });
  } catch (error: any) {
    console.error('Crowd flow error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load crowd flow' });
  }
};

/**
 * Incidents the rule engine raised for this event.
 *
 * Only `source: ANOMALY` - a manually reported incident is not an anomaly, and
 * mixing them would overstate what the system detected on its own.
 */
export const getAnomalies = async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const take = Math.min(Math.max(Number(req.query.take) || 50, 1), 200);

    const anomalies = await prisma.incident.findMany({
      where: { eventId: event.id, source: 'ANOMALY' },
      orderBy: { timestamp: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        description: true,
        location: true,
        latitude: true,
        longitude: true,
        timestamp: true,
        ruleKey: true,
        detectionConfidence: true,
        camera: { select: { id: true, cameraId: true, name: true } },
      },
    });

    res.status(200).json({ success: true, data: anomalies, total: anomalies.length });
  } catch (error: any) {
    console.error('Anomalies error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load anomalies' });
  }
};
