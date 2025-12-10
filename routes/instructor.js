import express from "express";
import multer from "multer";
import { 
  showInstructorCourses, 
  showCreateCourseForm, 
  createCourse,
  showEditCourseForm,
  updateCourse,
  deleteCourse,
  toggleCourseStatus,
  viewCourseStudents,
  notifyStudent
} from "../controllers/instructorController.js";

const router = express.Router();

// Middleware
function ensureInstructor(req, res, next) {
  const user = req.session?.user;
  if (!user) return res.redirect("/signin");
  if (user.role !== "instructor" && user.role !== "admin") {
    return res.status(403).send("Bạn không có quyền truy cập trang này");
  }
  req.user = user;
  next();
}

// Multer upload
const storage = multer.diskStorage({
  destination: "./public/uploads/course-thumbnails/",
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e5);
    cb(null, unique + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// =============================
// ROUTES
// =============================

// LIST
router.get("/courses", ensureInstructor, showInstructorCourses);

// CREATE
router.get("/courses/create", ensureInstructor, showCreateCourseForm);
router.post("/courses/create", ensureInstructor, upload.single("thumbnail"), createCourse);

// EDIT
router.get("/courses/:id/edit", ensureInstructor, showEditCourseForm);
router.post("/courses/:id/edit", ensureInstructor, upload.single("thumbnail"), updateCourse);
router.post("/courses/:id/status", toggleCourseStatus);
router.get("/courses/:courseId/students", ensureInstructor, viewCourseStudents);
router.post("/courses/:courseId/students/:studentId/notify", ensureInstructor, notifyStudent);

// DELETE
router.get("/courses/:id/delete", ensureInstructor, deleteCourse);

export default router;
