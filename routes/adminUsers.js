import express from "express";
import {
  listUsers,
  getUserDetail,
  updateUser,
  changeRole,
  banUser,
  unbanUser,
  softDeleteUser
} from "../controllers/adminUsersController.js";

import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Danh sách user
router.get("/", requireAdmin, listUsers);

// Chi tiết user
router.get("/:id", requireAdmin, getUserDetail);

// Update thông tin user
router.post("/:id/update", requireAdmin, updateUser);

// Đổi role
router.post("/:id/role", requireAdmin, changeRole);

// Ban / Unban
router.post("/:id/ban", requireAdmin, banUser);
router.post("/:id/unban", requireAdmin, unbanUser);

// Xóa mềm
router.post("/:id/delete", requireAdmin, softDeleteUser);

export default router;
