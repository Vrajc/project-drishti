import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  importCsv,
} from '../controllers/watchlist.controller.js';

const router = Router();

// The watchlist is police work. It uses the same JWT middleware as everything
// else - there is no second auth system.
const operators = authorize('admin', 'police');

router.get('/', authenticate, operators, listEntries);
router.post('/', authenticate, operators, createEntry);
router.post('/import', authenticate, operators, importCsv);
router.put('/:id', authenticate, operators, updateEntry);
router.delete('/:id', authenticate, operators, deleteEntry);

export default router;
