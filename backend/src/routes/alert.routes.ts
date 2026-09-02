import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { listAlerts, getAlertCounts, updateAlertStatus } from '../controllers/alert.controller.js';

const router = Router();

const operators = authorize('admin', 'police');

// Counts before '/:id' would not clash, but keeping the specific route first
// matches the convention used elsewhere in this codebase.
router.get('/counts', authenticate, operators, getAlertCounts);
router.get('/', authenticate, operators, listAlerts);
router.patch('/:id/status', authenticate, operators, updateAlertStatus);

export default router;
