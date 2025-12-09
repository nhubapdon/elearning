import express from "express";
import multer from "multer";
import {
  getCreateLessonPage,
  createLesson,
  getEditLessonPage,
  updateLesson,
  deleteMaterial,
  deleteLesson,
  hardDeleteLesson
} from "../controllers/lessonController.js";

const router = express.Router();

// ----------------------
// Multer Storage
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") {
      cb(null, "public/uploads/videos");
    } else if (file.fieldname === "materials") {
      cb(null, "public/uploads/lesson_materials");
    } else {
      cb(null, "public/uploads/others");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ======================
// ROUTES
// ======================

// CREATE
router.get("/:courseId/create", getCreateLessonPage);
router.post(
  "/:courseId/create",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "materials", maxCount: 20 },
  ]),
  createLesson
);

// EDIT
router.get("/:lessonId/edit", getEditLessonPage);
router.post(
  "/:lessonId/edit",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "materials", maxCount: 20 },
  ]),
  updateLesson
);
router.post("/:lessonId/delete", deleteLesson);
router.post("/:lessonId/hard-delete", hardDeleteLesson);

// DELETE MATERIAL
router.post("/delete-material/:id", deleteMaterial);

export default router;
