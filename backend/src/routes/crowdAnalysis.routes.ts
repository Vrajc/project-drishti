import express from 'express';
import {
  getCrowdDensity,
  getLatestDensity,
  getZoneStatistics,
  getHeatmapData,
  getEventZones,
} from '../controllers/crowdAnalysis.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /process is gone. Crowd density is not something an event uploads after
// the fact; it is counted live from the cameras the event has been assigned.

/**
 * @route   GET /api/crowd-analysis/:eventId/density
 * @desc    Get crowd density data for an event
 * @query   zoneId, startTime, endTime (optional)
 * @access  Private
 */
router.get('/:eventId/density', getCrowdDensity);

/**
 * @route   GET /api/crowd-analysis/:eventId/latest
 * @desc    Get latest crowd density for each zone
 * @access  Private
 */
router.get('/:eventId/latest', getLatestDensity);

/**
 * @route   GET /api/crowd-analysis/:eventId/zones/:zoneId/statistics
 * @desc    Get statistics for a specific zone
 * @query   startTime, endTime (optional)
 * @access  Private
 */
router.get('/:eventId/zones/:zoneId/statistics', getZoneStatistics);

/**
 * @route   GET /api/crowd-analysis/:eventId/heatmap
 * @desc    Get heatmap data for visualization
 * @query   startTime, endTime (optional)
 * @access  Private
 */
router.get('/:eventId/heatmap', getHeatmapData);

/**
 * @route   GET /api/crowd-analysis/:eventId/zones
 * @desc    Get all zones for an event
 * @access  Private
 */
router.get('/:eventId/zones', getEventZones);


export default router;
