import pool from "../db.js";
// routes/blog.js
import express from "express";
import {
  renderBlogList,
  renderBlogDetail,
  createPost,
  addComment,
  toggleLike,
  updatePost,
  deletePost,
  getPendingPosts,
  rejectPost
} from "../controllers/blogController.js";
import { checkAdmin } from "../middleware/checkAdmin.js";

import upload from "../middleware/upload.js";
const router = express.Router();

// ===========================
//  ⭐ Route phải theo thứ tự
// ===========================
// Danh sách bài viết
router.get("/", renderBlogList);

// Trang tạo bài viết
router.get("/create", async (req, res) => {
  const isAcademic = req.query.academic === "1";

  const tagQuery = await pool.query(`
    SELECT id, name, slug FROM blog_tags ORDER BY name ASC
  `);

  res.render("blog/create", {
    user: req.session.user,
    isAcademic,
    tagList: tagQuery.rows,
  });
});

// Trang edit bài viết
router.get("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;

  const postRes = await pool.query(`SELECT * FROM blog_posts WHERE id=$1`, [id]);
  if (!postRes.rows.length) return res.send("Không tìm thấy bài viết");

  const post = postRes.rows[0];

  if (!user || user.id !== post.user_id)
    return res.send("Không có quyền chỉnh sửa");

  const tagQuery = await pool.query(`SELECT * FROM blog_tags ORDER BY name ASC`);

  res.render("blog/edit", {
    post,
    user,
    tagList: tagQuery.rows,
  });
});

// Tạo bài viết
router.post("/create", upload.single("thumbnail"), createPost);
router.get("/admin/pending", checkAdmin, getPendingPosts);
// Thả tim
router.post("/:postId/like", toggleLike);

// Bình luận
router.post("/:postId/comment", addComment);

// Cập nhật bài viết — QUAN TRỌNG: thêm upload.single
router.put("/:postId", upload.single("thumbnail"), updatePost);

// Xóa bài viết
router.delete("/:postId", deletePost);
router.delete("/admin/reject/:id", checkAdmin, rejectPost);
// Trang chi tiết bài viết
router.get("/:slug", renderBlogDetail);


export default router;
