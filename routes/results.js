// backend/routes/results.js
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getResultsForUser, getResultsForQuiz } from '../controllers/resultsController.js';

const router = express.Router();

router.get('/me', authenticate, getResultsForUser); // user's results
router.get('/quiz/:quizId', authenticate, requireRole('instructor'), getResultsForQuiz); // instructor sees quiz results

export default router;
