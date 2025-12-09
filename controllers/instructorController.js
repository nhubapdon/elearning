import pool from "../db.js";

// =============================
// Instructor - Course Management Page
// =============================
export const showInstructorCourses = async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.redirect("/signin");

    // ✔ Admin có full quyền
    // ✔ Instructor chỉ xem khóa học của chính mình
    const isAdmin = user.role === "admin";

    if (!isAdmin && user.role !== "instructor") {
      return res.status(403).send("Bạn không có quyền truy cập trang này");
    }

    // ======================
    // 🔥 SEARCH + FILTER
    // ======================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = 8;
    const search = (req.query.search || "").trim();

    let idx = 1;
    const filters = [];
    const params = [];

    // 1) Nếu là INSTRUCTOR → luôn filter theo instructor_id
    if (!isAdmin) {
      filters.push(`c.instructor_id = $${idx++}`);
      params.push(user.id);
    }

    // 2) Search
    if (search) {
      filters.push(`c.title ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    // 3) ADMIN FILTER — Giảng viên
    if (isAdmin && req.query.instructor && req.query.instructor !== "all") {
      filters.push(`c.instructor_id = $${idx++}`);
      params.push(Number(req.query.instructor)); // ✔ tránh lỗi PostgreSQL
    }

    // 4) Filter theo trạng thái
    if (req.query.status && req.query.status !== "all") {
      if (req.query.status === "draft") {
        filters.push(`NOT EXISTS (SELECT 1 FROM enrollments e2 WHERE e2.course_id = c.id)`);
      } else if (req.query.status === "published") {
        filters.push(`EXISTS (SELECT 1 FROM enrollments e2 WHERE e2.course_id = c.id)`);
      }
    }

    // 5) Filter ngày tạo
    if (req.query.date_from) {
      filters.push(`c.created_at >= $${idx++}`);
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      filters.push(`c.created_at <= $${idx++}`);
      params.push(req.query.date_to);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // ======================
    // 🔥 COUNT TOTAL
    // ======================
    const countSql = `
      SELECT COUNT(*) AS total
      FROM courses c
      ${whereClause}
    `;
    const countRes = await pool.query(countSql, params);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(totalItems / perPage), 1);
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * perPage;

    // ======================
    // 🔥 LOAD COURSES
    // ======================
    const listSql = `
      SELECT 
        c.id,
        c.title,
        c.thumbnail,
        c.created_at,
        COALESCE(ROUND(AVG(e.progress_percent)), 0) AS progress,
        COUNT(DISTINCT e.user_id) AS enroll_count,
        CASE 
          WHEN COUNT(DISTINCT e.user_id) = 0 THEN 'draft'
          ELSE 'published'
        END AS status,
        u.full_name AS instructor_name
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN users u ON u.id = c.instructor_id
      ${whereClause}
      GROUP BY c.id, u.full_name
      ORDER BY c.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const listParams = [...params, perPage, offset];
    const { rows: courses } = await pool.query(listSql, listParams);

    // ======================
    // 🔥 PAGINATION DATA
    // ======================
    const pagination = {
      page: currentPage,
      totalPages,
      totalItems,
      perPage,
      search,
      from: totalItems === 0 ? 0 : offset + 1,
      to: Math.min(offset + perPage, totalItems),

      // GIỮ LẠI FILTER hiện tại để tự động điền vào UI:
      instructor: req.query.instructor || "all",
      status: req.query.status || "all",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || ""
    };

    // ======================
    // 🔥 ADMIN ONLY — LOAD LIST GIẢNG VIÊN
    // ======================
    let instructors = [];
    if (isAdmin) {
      const instRes = await pool.query(`
        SELECT id, full_name 
        FROM users
        WHERE role = 'instructor'
        ORDER BY full_name ASC
      `);
      instructors = instRes.rows;
    }

    // ======================
    // 🔥 RENDER VIEW
    // ======================
    return res.render("dashboard/instructor-courses", {
      user,
      isAdmin,
      courses,
      pagination,
      instructors,
      currentPage: "instructor-courses",
    });

  } catch (err) {
    console.error("Lỗi tải danh sách khóa học:", err);
    return res.status(500).send("Lỗi hệ thống");
  }
};

// =============================
// HIỂN THỊ FORM TẠO KHÓA HỌC
// =============================
export const showCreateCourseForm = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";

    // Nếu admin → lấy danh sách giảng viên
    let instructors = [];
    if (isAdmin) {
      const q = await pool.query(
        "SELECT id, full_name FROM users WHERE role = 'instructor'"
      );
      instructors = q.rows;
    }

    res.render("dashboard/course-create", {
      user,
      isAdmin,
      instructors,
      currentPage: "create-course"
    });

  } catch (err) {
    console.error("Lỗi mở form tạo khóa học:", err);
    return res.status(500).send("Không thể mở form tạo khóa học");
  }
};
// =============================
// 3) XỬ LÝ POST TẠO KHÓA HỌC
// =============================
export const createCourse = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";

    const { title, price, description, categories } = req.body;

    // Nếu admin → dùng instructor_id chọn từ dropdown
    const instructorId = isAdmin 
      ? req.body.instructor_id 
      : user.id;

    const thumbnail = req.file 
      ? "/uploads/course-thumbnails/" + req.file.filename 
      : null;

    const result = await pool.query(
      `
      INSERT INTO courses (title, price, description, instructor_id, thumbnail)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [title, price, description, instructorId, thumbnail]
    );

    const courseId = result.rows[0].id;

    // Lưu category
    if (categories) {
      const catList = Array.isArray(categories) ? categories : [categories];
      for (let cat of catList) {
        await pool.query(
          `INSERT INTO course_categories (course_id, category_id) VALUES ($1, $2)`,
          [courseId, cat]
        );
      }
    }

    return res.redirect(`/instructor/courses/${courseId}/lessons`);
  } catch (err) {
    console.error("Lỗi tạo khóa học:", err);
    return res.status(500).send("Không thể tạo khóa học");
  }
};

// ==========================
// GET EDIT PAGE
// ==========================
export async function showEditCourseForm(req, res) {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";
    const courseId = req.params.id;

    // Admin lấy khóa học của bất kỳ ai
    // Instructor chỉ lấy khóa học của chính họ
    const q = await pool.query(
      `
      SELECT * FROM courses
      WHERE id = $1
      ${!isAdmin ? "AND instructor_id = $2" : ""}
      `,
      !isAdmin ? [courseId, user.id] : [courseId]
    );

    if (q.rows.length === 0) {
      return res.status(404).send("Không tìm thấy khóa học.");
    }

    // Lấy categories
    const cats = await pool.query(
      "SELECT category_id FROM course_categories WHERE course_id=$1",
      [courseId]
    );

    const course = q.rows[0];
    course.categories = cats.rows.map(c => c.category_id.toString());

    // Lấy danh sách giảng viên cho admin
    let instructors = [];
    if (isAdmin) {
      const t = await pool.query(
        "SELECT id, full_name FROM users WHERE role='instructor'"
      );
      instructors = t.rows;
    }

    res.render("dashboard/course-edit", {
      user,
      isAdmin,
      course,
      instructors
    });

  } catch (err) {
    console.error("Error showEditCourseForm:", err);
    res.status(500).send("Server error");
  }
}



// ==========================
// UPDATE COURSE
// ==========================
export const updateCourse = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";
    const courseId = req.params.id;

    const instructorId = isAdmin
      ? req.body.instructor_id
      : user.id;

    const { title, description, price } = req.body;

    let categories = req.body.categories || [];
    if (!Array.isArray(categories)) categories = [categories];

    const thumbnail = req.file
      ? "/uploads/course-thumbnails/" + req.file.filename
      : null;

    // UPDATE COURSE
    let setThumb = thumbnail ? `, thumbnail='${thumbnail}'` : "";

    await pool.query(
      `
      UPDATE courses 
      SET title=$1, description=$2, price=$3, instructor_id=$4 ${setThumb}
      WHERE id=$5
      `,
      [title, description, price, instructorId, courseId]
    );

    // Cập nhật categories
    await pool.query("DELETE FROM course_categories WHERE course_id=$1", [courseId]);
    for (const cat of categories) {
      await pool.query(
        "INSERT INTO course_categories (course_id, category_id) VALUES ($1, $2)",
        [courseId, cat]
      );
    }

    res.redirect("/instructor/courses");

  } catch (err) {
    console.error("Error updateCourse:", err);
    res.status(500).send("Lỗi server khi cập nhật khóa học");
  }
};

// ==========================
// DELETE COURSE
// ==========================
export async function deleteCourse(req, res) {
  const { id } = req.params;
  const instructorId = req.user.id;

  try {
    await pool.query(
      `DELETE FROM courses WHERE id = $1 AND instructor_id = $2`,
      [id, instructorId]
    );

    res.redirect("/instructor/courses");

  } catch (err) {
    console.error("Error deleteCourse:", err);
    res.status(500).send("Server error");
  }
}
export const toggleCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      `UPDATE courses SET status = $1 WHERE id = $2`,
      [status, id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Toggle status error:", err);
    res.status(500).json({ success: false });
  }
};
