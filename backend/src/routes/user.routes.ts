import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  getUserStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';

const router = Router();

// Ahead of '/:id', or "stats" is read as a user id.
router.get('/stats', authenticate, authorize('admin'), getUserStats);

router.get('/', authenticate, authorize('admin'), getUsers);

// Self or admin; the controller enforces which, because the middleware cannot
// see whose record is being asked for.
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, updateUser);

router.delete('/:id', authenticate, authorize('admin'), deleteUser);

export default router;
