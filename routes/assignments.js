// routes/assignments.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import assignmentUpload from "../middleware/uploadAssignment.js";
import {
  listAssignmentsForCourse,
  getAssignmentDetail,
  submitAssignment,
} from "../controllers/assignmentsController.js";

const router = express.Router();

// Danh sách assignment của 1 khóa
router.get("/course/:courseId", requireAuth, listAssignmentsForCourse);

// Chi tiết + form nộp
router.get("/:id", requireAuth, getAssignmentDetail);

// Nộp bài (upload file)
router.post(
  "/:id/submit",
  requireAuth,
  assignmentUpload.single("file"),
  submitAssignment
);

export default router;
