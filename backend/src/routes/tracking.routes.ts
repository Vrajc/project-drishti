import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getTrail, searchDetections, getFacets } from '../controllers/tracking.controller.js';

const router = Router();

// Same JWT middleware as everything else - no second auth system.
const operators = authorize('admin', 'police');

router.get('/facets', authenticate, operators, getFacets);
router.get('/detections', authenticate, operators, searchDetections);
router.get('/plate/:plate', authenticate, operators, getTrail);

export default router;
