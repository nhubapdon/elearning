import express from "express";
import multer from "multer";

import {
  listQuizzes,
  showCreateForm,
  createQuiz,
  showEditForm,
  updateQuiz,
  deleteQuiz,
  exportQuizzesCsv,
  importQuizzesExcel,
  previewQuiz,
  exportQuizTemplate,
  quizDetail
} from "../../controllers/dashboardQuizzesController.js";

const router = express.Router();
const upload = multer({ dest: "tmp" });

// =======================
// ROUTES TĨNH (KHÔNG PARAM)
// =======================
router.get("/", listQuizzes);

router.get("/export/csv", exportQuizzesCsv);

router.post("/import", upload.single("file"), importQuizzesExcel);

router.get("/export/template", exportQuizTemplate);

// PREVIEW (AJAX) — PHẢI ĐỂ TRÊN
router.post("/preview", previewQuiz);

// CREATE
router.get("/new", showCreateForm);
router.post("/", createQuiz);

// =======================
// ROUTES CÓ PARAM — ĐỂ CUỐI
// =======================
// VIEW QUIZ DETAIL
router.get("/:id/detail", quizDetail);

router.get("/:id/edit", showEditForm);
router.post("/:id", updateQuiz);
router.post("/:id/delete", deleteQuiz);

export default router;
