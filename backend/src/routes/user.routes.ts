import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// User routes
router.get('/', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Get all users - to be implemented' });
});

router.get('/:id', authenticate, (req, res) => {
  res.json({ message: 'Get user by ID - to be implemented' });
});

router.put('/:id', authenticate, (req, res) => {
  res.json({ message: 'Update user - to be implemented' });
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Delete user - to be implemented' });
});

export default router;
