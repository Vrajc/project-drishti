import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { DispatchStatus, IncidentSeverity, IncidentType, IncidentStatus, Prisma } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { emitIncident } from '../lib/realtime.js';

/** Assignment states that mean a unit is still committed to this incident. */
const ACTIVE_DISPATCH_STATUSES: DispatchStatus[] = ['DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'];

// `reporter` is a foreign key to users.id, so every read that wants a human-readable
// reporter has to join. Exposed additively as `reporterName` — `reporter` keeps its
// existing meaning and position in the response so no caller breaks.
//
// The camera join is what makes an estate incident legible: a police operator
// needs the camera's identifier and site, not a UUID. It is additive too, and
// null for incidents that were reported by a human against an event.
const incidentInclude = {
  reporterUser: { select: { name: true } },
  camera: {
    select: {
      id: true,
      cameraId: true,
      name: true,
      location: true,
      latitude: true,
      longitude: true,
      status: true,
    },
  },
  site: { select: { id: true, code: true, name: true } },
  event: { select: { id: true, name: true } },
  assignments: {
    where: { status: { in: ACTIVE_DISPATCH_STATUSES } },
    select: {
      id: true,
      status: true,
      dispatchedAt: true,
      acknowledgedAt: true,
      arrivedAt: true,
      unit: { select: { id: true, unitId: true, name: true, type: true } },
    },
  },
};

const typeMap: Record<string, IncidentType> = {
  medical: 'MEDICAL',
  security: 'SECURITY',
  lost_found: 'LOST_FOUND',
  general: 'GENERAL',
};

const statusMap: Record<string, IncidentStatus> = {
  open: 'OPEN',
  investigating: 'INVESTIGATING',
  resolved: 'RESOLVED',
};

const severityMap: Record<string, IncidentSeverity> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

// Format incident to match frontend expectations (lowercase enums, _id field).
// Every field added here is additive: the shape LiveMonitoring, OrganizerDashboard
// and AdminDashboard already read is unchanged.
function formatIncident(inc: any) {
  const { reporterUser, camera, site, event, assignments, ...rest } = inc;
  return {
    ...rest,
    _id: inc.id,
    type: inc.type.toLowerCase(),
    status: inc.status.toLowerCase(),
    severity: inc.severity ? inc.severity.toLowerCase() : null,
    source: inc.source.toLowerCase(),
    reporterName: reporterUser?.name ?? null,
    camera: camera ?? null,
    site: site ?? null,
    eventName: event?.name ?? null,
    // Present only where the incident is being worked. An empty array means
    // nobody has been sent, which is exactly what the console needs to show.
    activeAssignments: (assignments ?? []).map((a: any) => ({
      ...a,
      _id: a.id,
      status: a.status.toLowerCase(),
    })),
    // 'event' or 'estate' — which console owns this incident.
    scope: inc.eventId ? 'event' : 'estate',
  };
}

// Create a new incident
export const createIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, cameraId, type, description, location, severity, photo } = req.body;

    // The reporter is taken from the verified token, never from the request body. The
    // client used to send the user's display name, which violated incidents_reporter_fkey
    // and made every report fail with a 500 — the incidents table was empty as a result.
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // An incident belongs to an event, or to a registry camera, or to both when
    // an event camera raised it. Neither is the one case the database refuses
    // (incidents_scope_check), so it is refused here too, with a readable reason.
    if (!eventId && !cameraId) {
      return res.status(400).json({
        success: false,
        message: 'Either eventId or cameraId is required — an incident needs a jurisdiction',
      });
    }

    if (!description) {
      return res.status(400).json({ success: false, message: 'description is required' });
    }

    // A photo is optional, but a value that is not one must not be stored: a
    // column holding something no <img> can render would show every viewer a
    // broken attachment on a report that says it has one.
    let storedPhoto: string | null = null;
    if (photo !== undefined && photo !== null && photo !== '') {
      const value = String(photo);
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(value)) {
        return res.status(400).json({
          success: false,
          message: 'photo must be a base64 data URL for a PNG, JPEG, WebP or GIF image',
        });
      }
      // Roughly 6MB of base64, under the 50mb body limit with room for the rest
      // of the report. The client downscales before sending; this is the floor.
      if (value.length > 6_000_000) {
        return res.status(413).json({
          success: false,
          message: 'photo is too large — attach an image under about 4MB',
        });
      }
      storedPhoto = value;
    }

    if (severity && !severityMap[severity]) {
      return res.status(400).json({
        success: false,
        message: `severity must be one of ${Object.keys(severityMap).join(', ')}`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Reporting user no longer exists' });
    }

    // A camera-raised incident inherits the camera's surveyed position and site,
    // so the console can place it on the map. A camera with no coordinates
    // contributes none, and the incident is simply unplaced — the same rule the
    // registry map follows rather than dropping a pin at 0,0.
    let camera = null;
    if (cameraId) {
      camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        select: { id: true, location: true, latitude: true, longitude: true, siteId: true },
      });

      if (!camera) {
        return res.status(400).json({
          success: false,
          message: 'Incident references a camera that does not exist',
        });
      }
    }

    const resolvedLocation = location || camera?.location;
    if (!resolvedLocation) {
      return res.status(400).json({ success: false, message: 'location is required' });
    }

    const incident = await prisma.incident.create({
      data: {
        eventId: eventId || null,
        cameraId: camera?.id ?? null,
        siteId: camera?.siteId ?? null,
        type: typeMap[type] || 'GENERAL',
        // Unset rather than MEDIUM: a filer who was not asked for a severity
        // has not given one, and the console shows it as unassessed.
        severity: severity ? severityMap[severity] : null,
        // A human is filing this. Only the rule engine may write ANOMALY, and
        // the database enforces that a MANUAL row names its reporter.
        source: 'MANUAL',
        description,
        location: resolvedLocation,
        photo: storedPhoto,
        latitude: camera?.latitude ?? null,
        longitude: camera?.longitude ?? null,
        reporter: user.id,
        reporterEmail: user.email,
        timestamp: new Date(),
        status: 'OPEN',
      },
      include: incidentInclude,
    });

    const formatted = formatIncident(incident);
    emitIncident('incident:new', formatted);

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error creating incident:', error);

    // Surface a referential failure honestly instead of a generic 500.
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Incident references an event or camera that does not exist',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error reporting incident',
      error: error.message,
    });
  }
};

/**
 * The jurisdiction-wide incident feed — the police console's primary read.
 *
 * Returns incidents across every camera and every event, which is precisely
 * what an event-scoped route could never do and why POLICE had nothing to
 * operate before this. Filters are all optional and all translate to indexed
 * columns.
 */
export const getEstateIncidents = async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity, source, cameraId, siteId, scope, since, take } = req.query;

    const where: Prisma.IncidentWhereInput = {};

    if (status) {
      const mapped = statusMap[status as string];
      if (!mapped) {
        return res.status(400).json({
          success: false,
          message: `status must be one of ${Object.keys(statusMap).join(', ')}`,
        });
      }
      where.status = mapped;
    }

    if (severity) {
      const mapped = severityMap[severity as string];
      if (!mapped) {
        return res.status(400).json({
          success: false,
          message: `severity must be one of ${Object.keys(severityMap).join(', ')}`,
        });
      }
      where.severity = mapped;
    }

    if (source === 'manual' || source === 'anomaly') {
      where.source = source.toUpperCase() as 'MANUAL' | 'ANOMALY';
    }

    if (cameraId) where.cameraId = cameraId as string;
    if (siteId) where.siteId = siteId as string;

    // 'estate' = raised against a camera with no event behind it. 'event' = the
    // organizer-owned half. Omitted means everything the operator can see.
    if (scope === 'estate') where.eventId = null;
    if (scope === 'event') where.eventId = { not: null };

    if (since) {
      const from = new Date(since as string);
      if (Number.isNaN(from.getTime())) {
        return res.status(400).json({ success: false, message: 'since must be an ISO timestamp' });
      }
      where.timestamp = { gte: from };
    }

    const limit = Math.min(Number(take) || 200, 500);

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        // Postgres sorts NULLs first on DESC, which would put every
        // unassessed incident at the top of the queue. They sort last.
        orderBy: [
          { status: 'asc' },
          { severity: { sort: 'desc', nulls: 'last' } },
          { timestamp: 'desc' },
        ],
        include: incidentInclude,
        take: limit,
      }),
      prisma.incident.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: incidents.map(formatIncident),
      count: incidents.length,
      total,
    });
  } catch (error: any) {
    console.error('Error fetching estate incidents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incidents',
      error: error.message,
    });
  }
};

// Get incidents by event ID
export const getIncidentsByEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { status } = req.query;

    const where: any = { eventId };
    if (status) {
      where.status = statusMap[status as string] || status;
    }

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: incidentInclude,
    });

    res.status(200).json({
      success: true,
      data: incidents.map(formatIncident),
    });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incidents',
      error: error.message,
    });
  }
};

// Update incident status
export const updateIncidentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'investigating', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const incident = await prisma.incident.findUnique({ where: { id } });

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found',
      });
    }

    const updateData: any = { status: statusMap[status] };

    // Calculate response time if incident is being resolved
    if (status === 'resolved' && incident.status !== 'RESOLVED') {
      const resolvedAt = new Date();
      const responseTime = Math.floor((resolvedAt.getTime() - incident.timestamp.getTime()) / 1000);
      updateData.responseTime = responseTime;
      updateData.resolvedAt = resolvedAt;
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: updateData,
      include: incidentInclude,
    });

    const formatted = formatIncident(updated);
    emitIncident('incident:updated', formatted);

    res.status(200).json({
      success: true,
      message: 'Incident status updated',
      data: formatted,
    });
  } catch (error: any) {
    console.error('Error updating incident:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating incident status',
      error: error.message,
    });
  }
};

// Get all incidents (admin only)
export const getAllIncidents = async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.incident.findMany({
      orderBy: { timestamp: 'desc' },
      include: incidentInclude,
    });

    res.status(200).json({
      success: true,
      data: incidents.map(formatIncident),
    });
  } catch (error: any) {
    console.error('Error fetching all incidents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incidents',
      error: error.message,
    });
  }
};

// Delete an incident (admin, police)
export const deleteIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // DispatchAssignment cascades on delete, which removes the rows but leaves
    // every unit that was committed to this incident reading DISPATCHED with
    // nothing to explain it. Those units would then be missing from the
    // available list forever. Free them in the same transaction as the delete.
    await prisma.$transaction(async (tx) => {
      const committed = await tx.dispatchAssignment.findMany({
        where: { incidentId: id, status: { in: ACTIVE_DISPATCH_STATUSES } },
        select: { unitId: true },
      });

      await tx.incident.delete({ where: { id } });

      for (const { unitId } of committed) {
        // Only free a unit that has no other live assignment - it may well be
        // working a second incident.
        const stillCommitted = await tx.dispatchAssignment.count({
          where: { unitId, status: { in: ACTIVE_DISPATCH_STATUSES } },
        });

        if (stillCommitted === 0) {
          await tx.dispatchUnit.update({ where: { id: unitId }, data: { status: 'AVAILABLE' } });
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Incident deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting incident:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting incident',
      error: error.message,
    });
  }
};
