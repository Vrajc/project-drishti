import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { IncidentType, IncidentStatus } from '@prisma/client';

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
  return {
    ...inc,
    _id: inc.id,
    type: inc.type.toLowerCase(),
    status: inc.status.toLowerCase(),
  };
}

// Create a new incident
export const createIncident = async (req: Request, res: Response) => {
  try {
    const { eventId, type, description, location, reporter, reporterEmail } = req.body;

    const incident = await prisma.incident.create({
      data: {
        eventId,
        type: typeMap[type] || 'GENERAL',
        description,
        location,
        reporter,
        reporterEmail,
        timestamp: new Date(),
        status: 'OPEN',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: formatIncident(incident),
    });
  } catch (error: any) {
    console.error('Error creating incident:', error);
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
