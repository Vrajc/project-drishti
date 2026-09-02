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
  createDepartment,
  createSite,
  getDetectionStatus,
  startCameraDetection,
  stopCameraDetection,
  getCameraZones,
  createCameraZone,
  updateCameraZone,
  deleteCameraZone,
  runHealthCheck,
  runCameraHealthCheck,
  getHealthStatus,
  getCrowd,
  setCameraAssignment,
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

// Counting zones. Without these a Zone with a cameraId could only be created by
// hand against the database, so nothing in the product could ever be counted.
router.get('/cameras/:id/zones', authenticate, canRead, getCameraZones);
router.post('/cameras/:id/zones', authenticate, canWrite, createCameraZone);
router.put('/zones/:zoneId', authenticate, canWrite, updateCameraZone);
router.delete('/zones/:zoneId', authenticate, canWrite, deleteCameraZone);

// Detection. The ai-service has always had these endpoints; nothing called
// them, so the counting chain stopped after a zone was drawn.
router.get('/detection', authenticate, canRead, getDetectionStatus);
router.post('/cameras/:id/detection/start', authenticate, canWrite, startCameraDetection);
router.post('/cameras/:id/detection/stop', authenticate, canWrite, stopCameraDetection);

// Probing is a write in the sense that it records CameraHealth rows and moves
// Camera.status, so it is held to the same roles as editing the registry.
router.post('/cameras/:id/health-check', authenticate, canWrite, runCameraHealthCheck);
router.post('/health-check', authenticate, canWrite, runHealthCheck);
router.get('/health', authenticate, canRead, getHealthStatus);

// Assignment is how a registry camera joins an event. Organizers need it for
// their own events, so it is behind canRead and the service checks ownership -
// the middleware cannot see which event is being targeted.
router.put('/cameras/:id/assignment', authenticate, canRead, setCameraAssignment);

router.get('/departments', authenticate, canRead, getDepartments);
router.post('/departments', authenticate, canWrite, createDepartment);
router.get('/sites', authenticate, canRead, getSites);
router.post('/sites', authenticate, canWrite, createSite);
router.get('/stats', authenticate, canRead, getStats);

// Estate-wide occupancy, the counterpart to the event-scoped crowd-analysis API.
router.get('/crowd', authenticate, canRead, getCrowd);

export default router;
