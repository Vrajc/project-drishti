import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  getCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  getDepartments,
  getSites,
  getStats,
  getCameraStreamEndpoints,
  runHealthCheck,
  runCameraHealthCheck,
  getHealthStatus,
} from '../controllers/surveillance.controller.js';

const router = Router();

// The camera registry is operational infrastructure, not public information:
// every route requires a token, and writes are restricted to the two roles that
// own the estate. Event organizers can read the registry so they can attach a
// camera to their event, but they cannot alter the estate itself.
const canRead = authorize('admin', 'police', 'organizer');
const canWrite = authorize('admin', 'police');

router.get('/cameras', authenticate, canRead, getCameras);
router.get('/cameras/:id', authenticate, canRead, getCamera);
router.post('/cameras', authenticate, canWrite, createCamera);
router.put('/cameras/:id', authenticate, canWrite, updateCamera);
router.delete('/cameras/:id', authenticate, canWrite, deleteCamera);

// Playback. Reading is enough - watching a feed does not change the estate.
router.get('/cameras/:id/stream', authenticate, canRead, getCameraStreamEndpoints);

// Probing is a write in the sense that it records CameraHealth rows and moves
// Camera.status, so it is held to the same roles as editing the registry.
router.post('/cameras/:id/health-check', authenticate, canWrite, runCameraHealthCheck);
router.post('/health-check', authenticate, canWrite, runHealthCheck);
router.get('/health', authenticate, canRead, getHealthStatus);

router.get('/departments', authenticate, canRead, getDepartments);
router.get('/sites', authenticate, canRead, getSites);
router.get('/stats', authenticate, canRead, getStats);

export default router;
