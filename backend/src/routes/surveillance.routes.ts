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

router.get('/departments', authenticate, canRead, getDepartments);
router.get('/sites', authenticate, canRead, getSites);
router.get('/stats', authenticate, canRead, getStats);

export default router;
