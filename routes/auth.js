import express from "express";
import { register, login, me } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; 
import pool from "../db.js";   // ✅ thêm dòng này để dùng kết nối PostgreSQL
import passport from "passport";


const router = express.Router();

router.get("/signin", (req, res) => {
  const flashError = req.flash("error"); // luôn là array

  res.render("auth/signin", {
    title: "Đăng nhập - E-Learning",
    user: req.session.user || null,
    query: req.query,
    error: flashError.length > 0 ? flashError[0] : null // ⭐ chỉ lấy nếu có
  });
});



router.get("/signup", (req, res) => {
  res.render("auth/signup", {
    title: "Đăng ký - E-Learning",
    user: req.session.user || null
  });
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, me);
// Xử lý đăng ký qua form EJS
router.post("/signup", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Email và mật khẩu là bắt buộc!");
    }

    // Mã hóa mật khẩu
    const hashed = await bcrypt.hash(password, 10);

    // Lưu vào CSDL
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role`,
      [full_name, email, hashed, "student"]
    );
    const user = result.rows[0];

    // Tạo JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    // Lưu vào session
    req.session.user = user;
    req.session.token = token;

    // Chuyển về trang chủ
    res.redirect("/");
  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
    res.status(500).send("Đăng ký thất bại. Vui lòng thử lại.");
  }
});
// 🧭 Đăng xuất người dùng
router.get("/logout", (req, res) => {
  // Xoá session
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Lỗi khi đăng xuất:", err);
      return res.status(500).send("Lỗi máy chủ khi đăng xuất");
    }

    // Xoá cookie session (nếu dùng)
    res.clearCookie("connect.sid");

    // Quay về trang chủ
    res.redirect("/");
  });
});
// 🔹 Bắt đầu quá trình đăng nhập Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// 🔹 Callback từ Google sau khi xác thực
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/signin",
    failureFlash: true
  }),
  (req, res) => {
    req.session.user = req.user;
    res.redirect("/");
  }
);


export default router;
