import express from "express";
import multer from "multer";
import { checkAdmin } from "../../middleware/checkAdmin.js";  // 👈 THÊM

import {
  listInstructors,
  renderAddInstructor,
  addInstructor,
  renderEditInstructor,
  updateInstructor,
  deleteInstructor,
} from "../../controllers/admin/dashboardInstructorsController.js";

const router = express.Router();

// Multer (avatar upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/avatars"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ======================
// ROUTES (Protected)
// ======================

// Tất cả routes của admin GIẢNG VIÊN phải qua checkAdmin
router.get("/", checkAdmin, listInstructors);
router.get("/add", checkAdmin, renderAddInstructor);
router.post("/add", checkAdmin, upload.single("avatar"), addInstructor);
router.get("/edit/:id", checkAdmin, renderEditInstructor);
router.post("/edit/:id", checkAdmin, upload.single("avatar"), updateInstructor);
router.post("/delete/:id", checkAdmin, deleteInstructor);

export default router;
