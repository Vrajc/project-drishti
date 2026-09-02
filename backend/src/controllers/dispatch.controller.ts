import { Response } from 'express';
import * as dispatch from '../services/dispatch.service.js';
import { ValidationError } from '../services/surveillance.service.js';
import { getAnomalyCoverage } from '../services/anomalyRules.service.js';
import { emitIncident, emitToEstate } from '../lib/realtime.js';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

// Same envelope as the rest of the API: { success, data } / { success: false, message }.

function fail(res: Response, error: any, fallback: string) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  // The partial unique index on live assignments. Two operators dispatching the
  // same unit to the same incident at once is a conflict, not a server fault.
  if (error?.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'That unit already has a live assignment to this incident',
    });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

export const getUnits = async (req: AuthRequest, res: Response) => {
  try {
    const units = await dispatch.listUnits({
      eventId: req.query.eventId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      status: req.query.status as string | undefined,
      scope: req.query.scope as string | undefined,
    });

    res.status(200).json({ success: true, data: units, count: units.length });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch dispatch units');
  }
};

/** Units that could serve one incident, nearest surveyed unit first. */
export const getUnitsForIncident = async (req: AuthRequest, res: Response) => {
  try {
    const result = await dispatch.rankUnitsForIncident(req.params.incidentId);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    fail(res, error, 'Failed to rank dispatch units');
  }
};

export const getAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await dispatch.listAssignmentsForIncident(req.params.incidentId);
    res.status(200).json({ success: true, data: assignments, count: assignments.length });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch dispatch assignments');
  }
};

export const createDispatch = async (req: AuthRequest, res: Response) => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { incidentId, unitId, notes } = req.body;
    if (!incidentId || !unitId) {
      return res
        .status(400)
        .json({ success: false, message: 'incidentId and unitId are required' });
    }

    const assignment = await dispatch.dispatchUnit({
      incidentId,
      unitId,
      // The dispatcher is the verified token holder, never a body field. The
      // audit trail is worthless if the client can name someone else.
      dispatchedBy: operatorId,
      notes,
    });

    // Tell the estate console and, when the incident belongs to an event, that
    // event's own watchers. The REST reads remain authoritative; this only
    // saves them a poll interval.
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { eventId: true, status: true },
    });

    emitIncident('dispatch:new', {
      eventId: incident?.eventId ?? null,
      incidentId,
      assignment,
    });

    if (incident) {
      emitIncident('incident:updated', {
        eventId: incident.eventId,
        _id: incidentId,
        id: incidentId,
        status: incident.status.toLowerCase(),
      });
    }

    res.status(201).json({ success: true, message: 'Unit dispatched', data: assignment });
  } catch (error: any) {
    fail(res, error, 'Failed to dispatch unit');
  }
};

/** acknowledge | arrive | clear | cancel */
export const updateDispatch = async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await dispatch.advanceAssignment({
      assignmentId: req.params.id,
      action: req.body.action,
      notes: req.body.notes,
    });

    emitIncident('dispatch:updated', {
      eventId: assignment.incident?.eventId ?? null,
      incidentId: assignment.incidentId,
      assignment,
    });

    res.status(200).json({ success: true, message: `Assignment ${req.body.action}d`, data: assignment });
  } catch (error: any) {
    fail(res, error, 'Failed to update dispatch assignment');
  }
};

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [dispatchStats, anomalyCoverage] = await Promise.all([
      dispatch.getDispatchStats(),
      getAnomalyCoverage(),
    ]);

    res.status(200).json({ success: true, data: { ...dispatchStats, anomalies: anomalyCoverage } });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch dispatch statistics');
  }
};

/**
 * Update a unit's own availability (a unit going off shift, or coming back).
 * Deliberately narrow: this endpoint sets nothing but `status`, so it cannot be
 * used to move a unit's surveyed position from the console.
 */
export const updateUnitStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const allowed = ['available', 'busy', 'offline'];

    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: `status must be one of ${allowed.join(', ')}` });
    }

    // DISPATCHED is owned by the assignment lifecycle. Letting an operator set
    // it by hand would decouple a unit's status from the assignment that is
    // supposed to explain it.
    const unit = await prisma.dispatchUnit.update({
      where: { id: req.params.id },
      data: { status: status.toUpperCase() },
      include: {
        department: { select: { id: true, code: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    });

    const formatted = dispatch.formatUnit(unit);
    emitToEstate('dispatch:updated', { unit: formatted });

    res.status(200).json({ success: true, message: 'Unit status updated', data: formatted });
  } catch (error: any) {
    fail(res, error, 'Failed to update unit status');
  }
};
