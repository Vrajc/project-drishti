import express from 'express';
import {
  getUnits,
  getUnitsForIncident,
  getAssignments,
  createDispatch,
  updateDispatch,
  updateUnitStatus,
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

router.get('/incidents/:incidentId/units', authenticate, canDispatch, getUnitsForIncident);
router.get('/incidents/:incidentId/assignments', authenticate, canDispatch, getAssignments);

router.post('/', authenticate, canDispatch, createDispatch);
router.put('/:id', authenticate, canDispatch, updateDispatch);

// Estate-wide counters, which only an estate-wide role has any use for.
router.get('/stats', authenticate, estateOnly, getStats);

export default router;
