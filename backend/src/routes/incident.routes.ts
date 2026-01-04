import express from 'express';
import {
  createIncident,
  getIncidentsByEvent,
  updateIncidentStatus,
  getAllIncidents,
  deleteIncident,
} from '../controllers/incident.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Create incident (authenticated users)
router.post('/', authenticate, createIncident);

// Get incidents by event ID (authenticated users)
router.get('/event/:eventId', authenticate, getIncidentsByEvent);

// Update incident status (authenticated users - organizers)
router.put('/:id/status', authenticate, updateIncidentStatus);

// Get all incidents (admin only)
router.get('/', authenticate, getAllIncidents);

// Delete incident (admin only)
router.delete('/:id', authenticate, deleteIncident);

export default router;
