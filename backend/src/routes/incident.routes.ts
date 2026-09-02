import express from 'express';
import {
  createIncident,
  getIncidentsByEvent,
  getEstateIncidents,
  updateIncidentStatus,
  getAllIncidents,
  deleteIncident,
} from '../controllers/incident.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Create incident (authenticated users)
router.post('/', authenticate, createIncident);

// The jurisdiction-wide feed. Estate-scoped by definition, so it is limited to
// the two roles that hold estate-wide responsibility — the same pair that owns
// the camera registry. An organizer still reads their own event's incidents
// through /event/:eventId below.
router.get('/estate', authenticate, authorize('admin', 'police'), getEstateIncidents);

// Get incidents by event ID (authenticated users)
router.get('/event/:eventId', authenticate, getIncidentsByEvent);

// Update incident status (authenticated users - organizers)
router.put('/:id/status', authenticate, updateIncidentStatus);

// Get all incidents (admin only)
router.get('/', authenticate, getAllIncidents);

// Delete incident. Destructive and estate-wide, so it is not open to every
// authenticated caller the way the comment above it used to imply.
router.delete('/:id', authenticate, authorize('admin', 'police'), deleteIncident);

export default router;
