import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { register, login, getProfile, logout } from '../controllers/auth.controller.js';

const router = Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);

export default router;
