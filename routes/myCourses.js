import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";  // ✅ dùng middleware cho EJS
import { listAllAssignmentsOfUser } from "../controllers/assignmentsController.js";
const router = express.Router();
router.get("/assignments/all", requireAuth, listAllAssignmentsOfUser);
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id; // ✅ lấy user từ session
    const { rows: courses } = await db.query(`
      SELECT c.*, e.enrolled_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
    `, [userId]);

    res.render("my-courses/index", {
      user: req.session.user,
      courses
    });
  } catch (error) {
    console.error("❌ Lỗi khi load my-courses:", error);
    res.status(500).send("Lỗi máy chủ khi tải khóa học của bạn");
  }
});

export default router;
