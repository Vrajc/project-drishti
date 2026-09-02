import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getLiveMonitoring, getCrowdFlow, getAnomalies } from '../controllers/monitoring.controller.js';

const router = Router();

// Live monitoring aggregations for one event. Each of these was a placeholder
// returning a fixed string; each now answers from the tables the detection
// consumer, the health poller and the rule engine write to.
router.get('/events/:id/live', authenticate, authorize('organizer', 'admin', 'police'), getLiveMonitoring);
router.get('/events/:id/crowd-flow', authenticate, authorize('organizer', 'admin', 'police'), getCrowdFlow);
router.get('/events/:id/anomalies', authenticate, authorize('organizer', 'admin', 'police'), getAnomalies);

// There was a fourth stub here, POST /events/:id/emergency. It is not
// reimplemented because emergency dispatch is genuinely served by /api/dispatch,
// which assigns real DispatchUnit rows to real incidents. A second endpoint
// answering the same question differently is how two subsystems drift apart.

export default router;
