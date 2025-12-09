// routes/dashboardAssignments.js
import express from "express";
import {
  requireInstructorOrAdmin,
} from "../middleware/auth.js";
import assignmentUpload from "../middleware/uploadAssignment.js";
import {
  listAssignmentsManage,
  renderCreateAssignmentForm,
  createAssignment,
  listSubmissionsForAssignment,
  gradeSubmission,
} from "../controllers/dashboardAssignmentsController.js";

const router = express.Router();

// Danh sách assignment theo khoá
router.get("/", requireInstructorOrAdmin, listAssignmentsManage);

// Form tạo assignment
router.get("/create", requireInstructorOrAdmin, renderCreateAssignmentForm);

// Tạo assignment (có thể upload file đề bài)
router.post(
  "/create",
  requireInstructorOrAdmin,
  assignmentUpload.single("attachment"),
  createAssignment
);

// Danh sách bài nộp của 1 assignment
router.get(
  "/:id/submissions",
  requireInstructorOrAdmin,
  listSubmissionsForAssignment
);

// Chấm điểm
router.post(
  "/submissions/:submissionId/grade",
  requireInstructorOrAdmin,
  gradeSubmission
);

export default router;
