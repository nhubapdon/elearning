// routes/quizzes.js
import express from "express";
import {
  startQuiz,
  submitQuiz
} from "../controllers/quizzesController.js";

const router = express.Router();

/**
 * Trang làm quiz
 * GET /quizzes/:courseId/start
 */
router.get("/:courseId/start", startQuiz);

/**
 * Submit kết quả quiz
 * POST /quizzes/:courseId/submit
 */
router.post("/:courseId/submit", submitQuiz);

export default router;
