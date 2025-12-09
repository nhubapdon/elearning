import pool from "../db.js";

/* ======================================================
   🧑‍💼 LIST USERS — GET /dashboard/users
====================================================== */
export const listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;

    const { q, role, status } = req.query;

    let where = ["deleted_at IS NULL"];
    let params = [];
    let idx = 1;

    if (q) {
      where.push(`(LOWER(full_name) LIKE $${idx} OR LOWER(email) LIKE $${idx})`);
      params.push(`%${q.toLowerCase()}%`);
      idx++;
    }

    if (role && role !== "all") {
      where.push(`role = $${idx}`);
      params.push(role);
      idx++;
    }

    if (status && status !== "all") {
      where.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereClause = "WHERE " + where.join(" AND ");

    const countSql = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countRes = await pool.query(countSql, params);
    const totalUsers = Number(countRes.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    const sql = `
      SELECT 
        u.id, u.full_name, u.email, u.role, u.status, u.avatar,
        u.created_at, u.last_login,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status='paid') AS total_orders,
        (SELECT SUM(o.total_price) FROM orders o WHERE o.user_id = u.id AND o.status='paid') AS total_spent
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const usersRes = await pool.query(sql, params);

    res.render("admin/users", {
      title: "Quản lý người dùng",
      user: req.session.user,
      users: usersRes.rows,
      currentPage: page,
      totalPages,
      totalUsers,
      filters: { q: q || "", role: role || "all", status: status || "all" }
    });

  } catch (err) {
    next(err);
  }
};

/* ======================================================
   👤 USER DETAIL — GET /dashboard/users/:id
====================================================== */
export const getUserDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const userSql = `
      SELECT id, full_name, email, role, status, avatar, phone, bio, created_at, last_login
      FROM users WHERE id = $1 AND deleted_at IS NULL
    `;
    const userRes = await pool.query(userSql, [id]);

    if (!userRes.rows.length) return res.status(404).send("User not found");

    const targetUser = userRes.rows[0];

    // Student stats
    const studentStats = await pool.query(`
      SELECT 
        COUNT(*) AS total_orders,
        SUM(total_price) AS total_spent
      FROM orders WHERE user_id=$1 AND status='paid'
    `, [id]);

    // Instructor stats
    const instructorStats = await pool.query(`
      SELECT 
        COUNT(c.id) AS total_courses,
        COUNT(DISTINCT o.user_id) AS total_students,
        SUM(oi.price) AS total_revenue
      FROM courses c
      LEFT JOIN order_items oi ON oi.course_id = c.id
      LEFT JOIN orders o ON o.id = oi.order_id AND o.status='paid'
      WHERE c.instructor_id=$1
    `, [id]);

    // Student courses
    const purchasedCourses = await pool.query(`
      SELECT c.id, c.title, c.thumbnail, c.price, o.created_at
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN courses c ON c.id = oi.course_id
      WHERE o.user_id=$1 AND o.status='paid'
      ORDER BY o.created_at DESC
    `, [id]);

    // Instructor courses
    const instructorCourses = await pool.query(`
      SELECT c.id, c.title, c.thumbnail, c.price, c.created_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS total_students
      FROM courses c
      WHERE c.instructor_id=$1
      ORDER BY c.created_at DESC
    `, [id]);

    res.render("admin/user-detail", {
      title: "Chi tiết người dùng",
      user: req.session.user,
      targetUser,
      studentStats: studentStats.rows[0],
      instructorStats: instructorStats.rows[0],
      purchasedCourses: purchasedCourses.rows,
      instructorCourses: instructorCourses.rows
    });

  } catch (err) {
    next(err);
  }
};

/* ======================================================
   ✏ UPDATE USER
====================================================== */
export const updateUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { full_name, email, phone, status, bio } = req.body;

    await pool.query(`
      UPDATE users 
      SET full_name=$1, email=$2, phone=$3, status=$4, bio=$5
      WHERE id=$6
    `, [full_name, email, phone || null, status, bio || null, id]);

    res.redirect(`/dashboard/users/${id}`);

  } catch (err) {
    next(err);
  }
};

/* ======================================================
   🔁 CHANGE ROLE
====================================================== */
export const changeRole = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);

    res.redirect(`/dashboard/users/${id}`);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   🔒 BAN / UNBAN
====================================================== */
export const banUser = async (req, res, next) => {
  await pool.query(`UPDATE users SET status='banned' WHERE id=$1`, [req.params.id]);
  res.redirect(`/dashboard/users/${req.params.id}`);
};

export const unbanUser = async (req, res, next) => {
  await pool.query(`UPDATE users SET status='active' WHERE id=$1`, [req.params.id]);
  res.redirect(`/dashboard/users/${req.params.id}`);
};

/* ======================================================
   🗑 SOFT DELETE USER
====================================================== */
export const softDeleteUser = async (req, res, next) => {
  await pool.query(`UPDATE users SET deleted_at=NOW() WHERE id=$1`, [req.params.id]);
  res.redirect("/dashboard/users");
};
