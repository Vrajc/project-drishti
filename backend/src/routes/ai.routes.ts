import express from 'express';
import {
  chatWithAI,
  analyzeEventSafety,
  analyzeIncident,
  analyzeCrowdFlow,
  generateEventReport,
  analyzeMonitoring,
  quickQuery
} from '../controllers/ai.controller';
// import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Authentication temporarily disabled for testing
// Uncomment the line below to enable authentication in production
// router.use(authenticate);

/**
 * POST /api/ai/chat
 * Chat with AI assistant
 */
router.post('/chat', chatWithAI);

/**
 * POST /api/ai/safety-planning
 * Analyze event for safety planning recommendations
 */
router.post('/safety-planning', analyzeEventSafety);

/**
 * POST /api/ai/analyze-incident
 * Analyze incident/anomaly
 */
router.post('/analyze-incident', analyzeIncident);

/**
 * POST /api/ai/crowd-flow
 * Predict crowd flow and bottlenecks
 */
router.post('/crowd-flow', analyzeCrowdFlow);

/**
 * POST /api/ai/generate-report
 * Generate post-event safety report
 */
router.post('/generate-report', generateEventReport);

/**
 * POST /api/ai/analyze-monitoring
 * Analyze live monitoring data
 */
router.post('/analyze-monitoring', analyzeMonitoring);

/**
 * POST /api/ai/query
 * Quick AI query
 */
router.post('/query', quickQuery);

export default router;
