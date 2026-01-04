import { Request, Response } from 'express';
import Incident from '../models/incident.model';

// Create a new incident
export const createIncident = async (req: Request, res: Response) => {
  try {
    const { eventId, type, description, location, reporter, reporterEmail } = req.body;

    const incident = new Incident({
      eventId,
      type,
      description,
      location,
      reporter,
      reporterEmail,
      timestamp: new Date(),
      status: 'open',
    });

    await incident.save();

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: incident,
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

    let query: any = { eventId };
    
    if (status) {
      query.status = status;
    }

    const incidents = await Incident.find(query).sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: incidents,
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

    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found',
      });
    }

    // Calculate response time if incident is being resolved
    if (status === 'resolved' && incident.status !== 'resolved') {
      const resolvedAt = new Date();
      const responseTime = Math.floor((resolvedAt.getTime() - incident.timestamp.getTime()) / 1000); // in seconds
      incident.status = status;
      incident.responseTime = responseTime;
      incident.resolvedAt = resolvedAt;
    } else {
      incident.status = status;
    }

    await incident.save();

    res.status(200).json({
      success: true,
      message: 'Incident status updated',
      data: incident,
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
    const incidents = await Incident.find().sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: incidents,
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

    const incident = await Incident.findByIdAndDelete(id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Incident deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting incident:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting incident',
      error: error.message,
    });
  }
};
