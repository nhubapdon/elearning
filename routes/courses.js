import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getAllCourses,
  getCourseDetail,
  enrollCourse,
  saveLessonProgress,
  submitReview,
  checkoutCourse,
  addToCart,
  submitQuiz,
} from "../controllers/coursesController.js";
import { issueCertificate } from "../controllers/certificatesController.js";

const router = express.Router();

/* 1. Danh sách */
router.get("/", getAllCourses);

/* ⭐ MUST BE FIRST – để không bị nuốt */
router.post("/:courseId/lesson/:lessonId/progress", requireAuth, saveLessonProgress);

/* ⭐ Certificate */
router.get("/:courseId/certificate", requireAuth, issueCertificate);

/* Add to cart */
router.get("/:id/add-to-cart", requireAuth, addToCart);

/* Checkout */
router.get("/:id/checkout", requireAuth, checkoutCourse);



/* Quiz submit */
router.post("/:id/quiz/submit", requireAuth, submitQuiz);

/* Enroll */
router.post("/:id/enroll", requireAuth, enrollCourse);

/* Review */
router.post("/:id/review", requireAuth, submitReview);
/* ⭐ Detail — phải luôn đặt cuối cùng */
router.get("/:id", getCourseDetail);
export default router;
