// controllers/profileController.js
import pool from "../db.js";
import bcrypt from "bcryptjs";

// =============================
// 📌 LẤY TRANG HỒ SƠ
// =============================
export const getProfile = async (req, res) => {
  try {
    const user = req.user || req.session.user;
    if (!user) return res.redirect("/signin");

    const userId = user.id;

    // =============================
    // 📊 LẤY THỐNG KÊ
    // =============================

    // 1️⃣ Tổng khóa học đã đăng ký
    const enrolledResult = await pool.query(
      `SELECT COUNT(*) AS total FROM enrollments WHERE user_id = $1`,
      [userId]
    );

    // 2️⃣ Tổng khóa học đã hoàn thành (progress_percent >= 100)
    const completedResult = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM enrollments 
       WHERE user_id = $1 AND progress_percent >= 99.9`,
      [userId]
    );

    // 3️⃣ Tổng thời gian đã học (tính bằng giờ)
    const hoursResult = await pool.query(
      `SELECT COALESCE(SUM(last_second), 0) AS seconds 
       FROM lesson_progress 
       WHERE enrollment_user_id = $1`,
      [userId]
    );

    const totalSeconds = Number(hoursResult.rows[0].seconds || 0);
    const totalHours = Math.floor(totalSeconds / 3600);

    const stats = {
      enrolledCount: Number(enrolledResult.rows[0].total || 0),
      completedCount: Number(completedResult.rows[0].total || 0),
      totalHours: totalHours,
    };

    // =============================
    // 📌 THÔNG TIN PROFILE (chưa có bảng riêng -> dùng mặc định)
    // =============================

    const profile = {
      phone: "",
      job_title: "",
      bio: "",
      linkedin: "",
      github: "",
    };

    // =============================
    // 🎛️ TUỲ CHỈNH NGƯỜI DÙNG (giả lập)
    // =============================
    const preferences = {
      language: "vi",
      theme: "light",
      notify_courses: true,
      notify_promos: false,
    };

    // =============================
    // 📜 HOẠT ĐỘNG GẦN ĐÂY (giả lập)
    // =============================
    const activity = [
      {
        title: "Đăng nhập hệ thống",
        description: "Bạn đã đăng nhập vào tài khoản",
        time: "Hôm nay",
      },
      {
        title: "Xem dashboard",
        description: "Bạn đã truy cập vào Dashboard",
        time: "Hôm nay",
      },
    ];

    return res.render("profile/index", {
      user,
      stats,
      profile,
      preferences,
      activity,
    });
  } catch (err) {
    console.error("❌ Lỗi getProfile:", err);
    return res.status(500).send("Có lỗi khi tải hồ sơ.");
  }
};

// =============================
// ✏️ CẬP NHẬT THÔNG TIN HỒ SƠ
// =============================
export const updateProfile = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const { full_name, phone, job_title, bio, linkedin, github } = req.body;

    await pool.query(
      `UPDATE users 
       SET full_name = $1,
           phone = $2,
           job_title = $3,
           bio = $4,
           linkedin = $5,
           github = $6
       WHERE id = $7`,
      [full_name, phone, job_title, bio, linkedin, github, user.id]
    );

    // Cập nhật session để UI thay đổi ngay lập tức
    req.session.user.full_name = full_name;
    req.session.user.phone = phone;
    req.session.user.job_title = job_title;
    req.session.user.bio = bio;
    req.session.user.linkedin = linkedin;
    req.session.user.github = github;

    return res.json({
      success: true,
      message: "Cập nhật thành công!",
      user: {
        full_name, phone, job_title, bio, linkedin, github
      }
    });

  } catch (err) {
    console.error("❌ Lỗi updateProfile:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server, không thể cập nhật."
    });
  }
};


// =============================
// 🔐 ĐỔI MẬT KHẨU
// =============================
export const changePassword = async (req, res) => {
  try {
    const user = req.user || req.session.user;
    if (!user) return res.redirect("/signin");

    const { current_password, new_password, confirm_password } = req.body;

    if (new_password !== confirm_password) {
      return res.send("Mật khẩu xác nhận không khớp");
    }

    const dbUser = await pool.query(
      `SELECT password FROM users WHERE id=$1`,
      [user.id]
    );

    if (!dbUser.rows.length) return res.send("Tài khoản không tồn tại");

    const match = await bcrypt.compare(current_password, dbUser.rows[0].password);
    if (!match) return res.send("Mật khẩu hiện tại không đúng");

    const hashed = await bcrypt.hash(new_password, 10);

    await pool.query(`UPDATE users SET password=$1 WHERE id=$2`, [
      hashed,
      user.id,
    ]);

    return res.redirect("/profile");
  } catch (err) {
    console.error("❌ Lỗi changePassword:", err);
    return res.status(500).send("Không thể đổi mật khẩu.");
  }
};

// =============================
// 🖼️ UPLOAD ẢNH ĐẠI DIỆN
// =============================
export const updateAvatar = async (req, res) => {
  try {
    const user = req.user || req.session.user;
    if (!user) return res.redirect("/signin");

    if (!req.file) return res.send("Vui lòng chọn ảnh.");

    const avatarPath = "/uploads/avatars/" + req.file.filename;

    await pool.query(
      `UPDATE users SET avatar=$1 WHERE id=$2`,
      [avatarPath, user.id]
    );

    req.session.user.avatar = avatarPath;

    res.redirect("/profile");
  } catch (err) {
    console.error("❌ Lỗi updateAvatar:", err);
    return res.status(500).send("Không thể cập nhật avatar.");
  }
};
