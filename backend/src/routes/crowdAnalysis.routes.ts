import express from 'express';
import {
  processVideoFootage,
  getCrowdDensity,
  getLatestDensity,
  getZoneStatistics,
  getHeatmapData,
  getEventZones,
  uploadVideo,
  generateMockData
} from '../controllers/crowdAnalysis.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/crowd-analysis/process
 * @desc    Upload and process video footage for crowd analysis
 * @access  Private (Organizers only)
 */
router.post('/process', uploadVideo.single('video'), processVideoFootage);

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

/**
 * @route   POST /api/crowd-analysis/:eventId/generate-mock
 * @desc    Generate mock crowd density data for testing
 * @access  Private
 */
router.post('/:eventId/generate-mock', generateMockData);

export default router;
