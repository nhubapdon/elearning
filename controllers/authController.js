// backend/controllers/authController.js
import pool from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

export const register = async (req, res) => {
  try {
    const { full_name, email, password, role = 'student' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, full_name, email, role`,
      [full_name || null, email, hashed, role]
    );
    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ user, token });
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra đầu vào
    if (!email || !password) {
      return res.status(400).send("Email và mật khẩu là bắt buộc!");
    }

    // Lấy user từ DB (có thêm status)
const result = await pool.query(
  `SELECT id, full_name, email, password, role, status, avatar 
   FROM users 
   WHERE email = $1`,
  [email]
);

    const user = result.rows[0];

    if (!user) {
      return res.status(404).send("Không tìm thấy người dùng");
    }

    // Nếu là tài khoản Google (password null) thì chặn login thường
    if (!user.password) {
      return res
        .status(400)
        .send("Tài khoản này được đăng nhập bằng Google. Hãy dùng nút Google để đăng nhập!");
    }

    // So sánh mật khẩu
    const plainPass = String(password || "");
    const hashPass = String(user.password || "");
    const match = await bcrypt.compare(plainPass, hashPass);

    if (!match) {
      return res.status(401).send("Sai mật khẩu hoặc email");
    }

    // ❗ Sau khi xác thực xong, kiểm tra trạng thái tài khoản
    if (user.status === "banned") {
      return res
        .status(403)
        .send("Tài khoản của bạn đã bị khóa bởi quản trị viên.");
    }

    // Xóa mật khẩu khỏi object user rồi lưu session
    delete user.password;

    req.session.user = user;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
    req.session.token = token;

    res.redirect("/");
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).send("Lỗi máy chủ trong quá trình đăng nhập");
  }
};





export const me = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
