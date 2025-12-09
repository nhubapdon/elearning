// routes/certificates.js
import express from "express";
import { issueCertificate, verifyCertificate } from "../controllers/certificatesController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Chỉ user đã login mới xin chứng chỉ
router.get("/courses/:courseId/certificate", requireAuth, issueCertificate);

// Link verify cho QR (public)
router.get("/certificates/verify", verifyCertificate);

export default router;
