import express from "express";
import { getNotifications, markNotificationRead } from "../controllers/instructorController.js";

const router = express.Router();

// Middleware để kiểm tra user đã đăng nhập
function ensureUser(req, res, next) {
  if (!req.session?.user) return res.status(401).json([]);
  next();
}

router.get("/", ensureUser, getNotifications);
router.post("/:id/read", ensureUser, markNotificationRead);

export default router;
