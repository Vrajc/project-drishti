import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { IncidentType, IncidentStatus } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth.middleware.js';

// `reporter` is a foreign key to users.id, so every read that wants a human-readable
// reporter has to join. Exposed additively as `reporterName` — `reporter` keeps its
// existing meaning and position in the response so no caller breaks.
const incidentInclude = {
  reporterUser: { select: { name: true } },
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

// Format incident to match frontend expectations (lowercase enums, _id field)
function formatIncident(inc: any) {
  const { reporterUser, ...rest } = inc;
  return {
    ...rest,
    _id: inc.id,
    type: inc.type.toLowerCase(),
    status: inc.status.toLowerCase(),
    reporterName: reporterUser?.name ?? null,
  };
}

// Create a new incident
export const createIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, type, description, location } = req.body;

    // The reporter is taken from the verified token, never from the request body. The
    // client used to send the user's display name, which violated incidents_reporter_fkey
    // and made every report fail with a 500 — the incidents table was empty as a result.
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!eventId || !description || !location) {
      return res.status(400).json({
        success: false,
        message: 'eventId, description and location are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Reporting user no longer exists' });
    }

    const incident = await prisma.incident.create({
      data: {
        eventId,
        type: typeMap[type] || 'GENERAL',
        description,
        location,
        reporter: user.id,
        reporterEmail: user.email,
        timestamp: new Date(),
        status: 'OPEN',
      },
      include: incidentInclude,
    });

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: formatIncident(incident),
    });
  } catch (error: any) {
    console.error('Error creating incident:', error);

    // Surface a referential failure honestly instead of a generic 500.
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Incident references an event that does not exist',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error reporting incident',
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

    res.status(200).json({
      success: true,
      message: 'Incident status updated',
      data: formatIncident(updated),
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

// Delete an incident (admin only)
export const deleteIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.incident.delete({ where: { id } });

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
