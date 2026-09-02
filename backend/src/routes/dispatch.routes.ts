import express from 'express';
import {
  getUnits,
  getUnitsForIncident,
  getAssignments,
  createDispatch,
  updateDispatch,
  updateUnitStatus,
  createUnit,
  updateUnit,
  deleteUnit,
  getStats,
} from '../controllers/dispatch.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================================================
// Dispatch is an operational capability, so every route needs a token.
//
// `police` and `admin` dispatch across the whole estate - that is the point of
// the role. `organizer` is included because an organizer has always been able
// to send their own marshals to their own event, and removing that while adding
// police would be a regression; the service refuses an organizer's attempt to
// commit a unit belonging to a different event.
//
// `participant` is absent throughout. Reporting an incident stays open to them
// via /api/incidents; deciding who responds to it does not.
// ============================================================================
const canDispatch = authorize('admin', 'police', 'organizer');
const estateOnly = authorize('admin', 'police');

router.get('/units', authenticate, canDispatch, getUnits);
router.put('/units/:id/status', authenticate, estateOnly, updateUnitStatus);

// The estate's own units. Event units are created with their event; these hang
// off a department, and until now the only way one existed was a seed script.
// estateOnly: an organizer manages their event's units through the event, not
// the responders a department owns.
router.post('/units', authenticate, estateOnly, createUnit);
router.put('/units/:id', authenticate, estateOnly, updateUnit);
router.delete('/units/:id', authenticate, estateOnly, deleteUnit);

router.get('/incidents/:incidentId/units', authenticate, canDispatch, getUnitsForIncident);
router.get('/incidents/:incidentId/assignments', authenticate, canDispatch, getAssignments);

router.post('/', authenticate, canDispatch, createDispatch);
router.put('/:id', authenticate, canDispatch, updateDispatch);

// Estate-wide counters, which only an estate-wide role has any use for.
router.get('/stats', authenticate, estateOnly, getStats);

export default router;
