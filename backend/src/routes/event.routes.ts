import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createEvent,
  getAllEvents,
  getEventsByOrganizer,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
} from '../controllers/event.controller';

const router = Router();

// Event routes
router.get('/', getAllEvents);

// Get events by organizer email
router.get('/organizer/:organizerEmail', getEventsByOrganizer);

router.get('/:id', getEventById);

router.post('/', authenticate, authorize('organizer', 'admin'), createEvent);

router.put('/:id', authenticate, authorize('organizer', 'admin'), updateEvent);

router.delete('/:id', authenticate, authorize('organizer', 'admin'), deleteEvent);

router.post('/:id/register', authenticate, registerForEvent);

export default router;
