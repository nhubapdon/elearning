import express from "express";
import {
  selectCoursePage,
  courseLessonsPage
} from "../controllers/dashboardLessonsController.js";

import { requireInstructorOrAdmin } from "../middleware/auth.js";

const router = express.Router();

// Chọn khóa học để quản lý bài học
router.get("/", requireInstructorOrAdmin, selectCoursePage);

// Trang liệt kê bài học trong khóa
router.get("/courses/:courseId/lessons", requireInstructorOrAdmin, courseLessonsPage);

export default router;

