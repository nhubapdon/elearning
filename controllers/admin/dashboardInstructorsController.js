import pool from "../../db.js";
import bcrypt from "bcryptjs";

// 📌 Danh sách giảng viên (kèm search + pagination + status + date filter)
export const listInstructors = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 6;
    const offset = (page - 1) * limit;

    const keyword = req.query.keyword || "";
    const status = req.query.status || "";
    const from = req.query.from || "";
    const to = req.query.to || "";

    // ===============================
    // XÂY DỰNG MẢNG CONDITIONS AN TOÀN
    // ===============================
    let conditions = [`role = 'instructor'`, `deleted_at IS NULL`];
    let params = [];
    let paramIndex = 1;

    // Tìm kiếm theo tên hoặc email
    if (keyword) {
      conditions.push(`(full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    // Lọc trạng thái
    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Lọc theo ngày tạo (from)
    if (from) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }

    // Lọc theo ngày tạo (to)
    if (to) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(to + " 23:59:59");
      paramIndex++;
    }

    // ===============================
    // QUERY LẤY DANH SÁCH
    // ===============================
    const query = `
      SELECT id, full_name, email, avatar, phone, bio, status, created_at
      FROM users
      WHERE ${conditions.join(" AND ")}
      ORDER BY id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const { rows: instructors } = await pool.query(query, params);

    // ===============================
    // QUERY ĐẾM TỔNG SỐ ROW
    // ===============================
    const countQuery = `
      SELECT COUNT(*) 
      FROM users
      WHERE ${conditions.join(" AND ")}
    `;

    const totalRes = await pool.query(countQuery, params.slice(0, paramIndex - 1));
    const totalPages = Math.ceil(totalRes.rows[0].count / limit);

    // ===============================
    // RENDER VIEW
    // ===============================
    res.render("admin/instructors/index", {
      instructors,
      page,
      totalPages,
      keyword,
      status,
      from,
      to,
    });

  } catch (err) {
    console.error("❌ listInstructors error:", err);
    res.status(500).send("Server error");
  }
};

// 📌 Form thêm
export const renderAddInstructor = (req, res) => {
  res.render("admin/instructors/add");
};

// 📌 Xử lý thêm giảng viên
export const addInstructor = async (req, res) => {
  try {
    const { full_name, email, password, phone, bio } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const avatarPath = req.file
      ? "/uploads/avatars/" + req.file.filename
      : null;

    await pool.query(
      `INSERT INTO users(full_name,email,password,role,phone,bio,provider,avatar)
       VALUES ($1,$2,$3,'instructor',$4,$5,'local',$6)`,
      [full_name, email, hashed, phone, bio, avatarPath]
    );

    res.redirect("/admin/instructors");
  } catch (err) {
    console.error("❌ addInstructor:", err);
    res.status(500).send("Server error");
  }
};

// 📌 Form sửa
export const renderEditInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND role='instructor'`,
      [id]
    );

    if (!rows.length) return res.send("Instructor not found");

    res.render("admin/instructors/edit", { instructor: rows[0] });
  } catch (err) {
    console.error("❌ renderEditInstructor:", err);
    res.status(500).send("Server error");
  }
};

// 📌 Cập nhật giảng viên (có cập nhật avatar)
export const updateInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, bio, status, new_password } = req.body;

    // Lấy avatar cũ
    const oldData = await pool.query(
      `SELECT avatar FROM users WHERE id=$1 AND role='instructor'`,
      [id]
    );

    let avatarPath = oldData.rows[0].avatar;

    // Nếu upload avatar mới
    if (req.file) {
      avatarPath = "/uploads/avatars/" + req.file.filename;
    }

    // =====================
    // 🔐 Nếu có password mới → hash
    // =====================
    let pwQuery = "";
    let params = [full_name, phone, bio, status, avatarPath, id];

    if (new_password && new_password.trim() !== "") {
      const hashed = await bcrypt.hash(new_password, 10);
      pwQuery = `, password = $7`;
      params = [full_name, phone, bio, status, avatarPath, id, hashed];
    }

    // =====================
    // UPDATE
    // =====================
    await pool.query(
      `
      UPDATE users
      SET full_name=$1,
          phone=$2,
          bio=$3,
          status=$4,
          avatar=$5
          ${pwQuery}
      WHERE id=$6
      `,
      params
    );

    res.redirect("/admin/instructors");

  } catch (err) {
    console.error("❌ updateInstructor:", err);
    res.status(500).send("Server error");
  }
};


// 📌 Xóa giảng viên (soft delete)
export const deleteInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND role = 'instructor'`,
      [id]
    );

    res.redirect("/admin/instructors");
  } catch (err) {
    console.error("❌ deleteInstructor:", err);
    res.status(500).send("Server error");
  }
};
