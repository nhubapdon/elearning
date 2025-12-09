// backend/routes/users.js
import express from 'express';
import { listUsers, getUser } from '../controllers/usersController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// admin only
router.get('/', authenticate, requireRole('admin'), listUsers);

// any authenticated user
router.get('/me', authenticate, getUser);

export default router;
