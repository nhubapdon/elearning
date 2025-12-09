import pool from "../db.js"; // nếu path khác thì giữ nguyên của bạn

export const renderHome = async (req, res) => {
  try {
    // 1️⃣ Lấy khoá học nổi bật
    const { rows: courses } = await pool.query(`
      SELECT *
      FROM courses
      ORDER BY id DESC
      LIMIT 4
    `);

    // 2️⃣ Lấy giảng viên
    const { rows: instructors } = await pool.query(`
      SELECT id, full_name, avatar, bio
      FROM users
      WHERE role = 'instructor' AND deleted_at IS NULL
      ORDER BY id DESC
      LIMIT 4
    `);

    // 3️⃣ Render view
    res.render("home/index", {
      title: "Trang chủ E-Learning",
      user: req.session.user || null,
      courses,
      instructors,
    });

  } catch (error) {
    console.error("❌ Lỗi render trang chủ:", error);

    res.render("home/index", {
      title: "Trang chủ E-Learning",
      user: req.session.user || null,
      courses: [],
      instructors: [],
    });
  }
};
