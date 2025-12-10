import pool from "../db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import cloudinary from "../config/cloudinary.js";
// =============================
// Instructor - Course Management Page
// =============================
export const showInstructorCourses = async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.redirect("/signin");

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

    // 1) Instructor chỉ xem khóa của mình
    if (!isAdmin) {
      filters.push(`c.instructor_id = $${idx++}`);
      params.push(Number(user.id));
    }

    // 2) Search theo tên khóa học
    if (search) {
      filters.push(`c.title ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    // 3) Admin filter theo giảng viên
    if (isAdmin && req.query.instructor && req.query.instructor !== "all") {
      const instructorId = Number(req.query.instructor);

      if (!isNaN(instructorId)) {
        filters.push(`c.instructor_id = $${idx++}`);
        params.push(instructorId);
      }
    }

    // 4) Filter theo trạng thái
    if (req.query.status && req.query.status !== "all") {
      if (req.query.status === "draft") {
        filters.push(`NOT EXISTS (
          SELECT 1 FROM enrollments e2 WHERE e2.course_id = c.id
        )`);
      } else if (req.query.status === "published") {
        filters.push(`EXISTS (
          SELECT 1 FROM enrollments e2 WHERE e2.course_id = c.id
        )`);
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
    // 🔥 COUNT TOTAL ITEMS
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
    // 🔥 LOAD COURSES LIST
    // ======================
    const listSql = `
      SELECT 
        c.id,
        c.title,
        c.thumbnail,
        c.created_at,

        COALESCE(ROUND(AVG(e.progress_percent)), 0) AS progress,
        COUNT(DISTINCT e.user_id) AS enroll_count,

        (
          SELECT json_agg(row_to_json(u))
          FROM (
            SELECT users.id, users.avatar
            FROM users
            JOIN enrollments e2 ON e2.user_id = users.id
            WHERE e2.course_id = c.id
            ORDER BY e2.enrolled_at ASC
            LIMIT 3
          ) u
        ) AS sample_students

      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const listParams = [...params, perPage, offset];
    const { rows: courses } = await pool.query(listSql, listParams);

    // ======================
    // 🔥 PAGINATION
    // ======================
    const pagination = {
      page: currentPage,
      totalPages,
      totalItems,
      perPage,
      search,
      from: totalItems === 0 ? 0 : offset + 1,
      to: Math.min(offset + perPage, totalItems),

      instructor: req.query.instructor || "all",
      status: req.query.status || "all",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || ""
    };

    // ======================
    // 🔥 LOAD LIST INSTRUCTORS (ADMIN only)
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

    const instructorId = isAdmin 
      ? req.body.instructor_id 
      : user.id;

    // 🔥 UPLOAD THUMBNAIL LÊN CLOUDINARY
    let thumbnailUrl = null;
    if (req.file) {
      thumbnailUrl = await uploadToCloudinary(
        req.file.path,
        "course_thumbnails"
      );
    }

    const result = await pool.query(
      `
      INSERT INTO courses (title, price, description, instructor_id, thumbnail)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [title, price, description, instructorId, thumbnailUrl]
    );

    const courseId = result.rows[0].id;

    // Lưu categories
    if (categories) {
      const catList = Array.isArray(categories) ? categories : [categories];
      for (let cat of catList) {
        await pool.query(
          `INSERT INTO course_categories (course_id, category_id) VALUES ($1, $2)`,
          [courseId, cat]
        );
      }
    }

    return res.redirect(`/instructor/courses/`);
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

    // ================================
    // 🔥 Lấy thumbnail cũ từ DB
    // ================================
    const oldThumbResult = await pool.query(
      "SELECT thumbnail FROM courses WHERE id=$1",
      [courseId]
    );

    let oldThumbnail = oldThumbResult.rows[0]?.thumbnail || null;
    let finalThumbnail = oldThumbnail;

    // ================================
    // 🔥 Nếu có upload thumbnail mới → upload Cloudinary
    // ================================
    if (req.file) {
      const uploadedThumb = await uploadToCloudinary(
        req.file.path,
        "course_thumbnails"
      );

      if (uploadedThumb) {
        finalThumbnail = uploadedThumb;

        // =========================================
        // 🔥 XOÁ THUMBNAIL CŨ TRÊN CLOUDINARY
        // =========================================
        if (oldThumbnail && oldThumbnail.startsWith("http")) {
          try {
            const fileName = oldThumbnail.split("/").pop();  // vd: abc123.jpg
            const publicId = fileName.split(".")[0];         // abc123

            await cloudinary.uploader.destroy(
              `course_thumbnails/${publicId}`,
              { resource_type: "image" }
            );

            console.log("Thumbnail cũ đã xoá:", publicId);

          } catch (err) {
            console.error("Không thể xoá thumbnail cũ Cloudinary:", err);
          }
        }
      }
    }

    // ================================
    // 🔥 UPDATE COURSE
    // ================================
    await pool.query(
      `
      UPDATE courses 
      SET title=$1, description=$2, price=$3, instructor_id=$4, thumbnail=$5
      WHERE id=$6
      `,
      [title, description, price, instructorId, finalThumbnail, courseId]
    );

    // ================================
    // 🔥 Cập nhật categories
    // ================================
    await pool.query("DELETE FROM course_categories WHERE course_id=$1", [courseId]);

    for (const cat of categories) {
      await pool.query(
        "INSERT INTO course_categories (course_id, category_id) VALUES ($1, $2)",
        [courseId, cat]
      );
    }

    res.redirect("/instructor/courses");

  } catch (err) {
    console.error("❌ Error updateCourse:", err);
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
// Xem danh sách học viên + tiến độ của 1 khóa học
export const viewCourseStudents = async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.redirect("/signin");

    const isAdmin = user.role === "admin";
    const { courseId } = req.params;

    // ==================================================
    // 🔍 1) Lấy thông tin khóa học
    // ==================================================
    const courseRes = await pool.query(
      `
        SELECT c.*, u.full_name AS instructor_name
        FROM courses c
        LEFT JOIN users u ON u.id = c.instructor_id
        WHERE c.id = $1
      `,
      [courseId]
    );

    if (!courseRes.rows.length) {
      return res.status(404).send("Không tìm thấy khóa học.");
    }

    const course = courseRes.rows[0];

    // -------------------------------------------------
    // 🔒 2) Kiểm tra quyền instructor/admin
    // -------------------------------------------------
    if (!isAdmin && course.instructor_id !== user.id) {
      return res.status(403).send("Bạn không có quyền với khóa học này.");
    }

    // -------------------------------------------------
    // 📊 3) Lấy tổng meta
    // -------------------------------------------------
    const metaRes = await pool.query(
      `
        SELECT 
          (SELECT COUNT(*) FROM lessons WHERE course_id = $1) AS total_lessons,
          (SELECT COUNT(*) FROM assignments WHERE course_id = $1) AS total_assignments,
          (SELECT COUNT(*) FROM quizzes WHERE course_id = $1) AS total_quizzes
      `,
      [courseId]
    );

    const meta = metaRes.rows[0];

    // -------------------------------------------------
    // 👥 4) Lấy danh sách học viên + tiến độ
    // -------------------------------------------------
    const studentsRes = await pool.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.avatar,

        e.enrolled_at,
        COALESCE(e.progress_percent, 0) AS progress_percent,

        -- ⭐ Số bài học đã hoàn thành
        (
          SELECT COUNT(*)
          FROM lesson_progress lp
          WHERE lp.enrollment_user_id   = e.user_id
            AND lp.enrollment_course_id = e.course_id
            AND lp.is_completed = true
        ) AS lessons_done,

        -- ⭐ Số bài tập đã nộp
        (
          SELECT COUNT(*)
          FROM assignment_submissions sub
          JOIN assignments a ON a.id = sub.assignment_id
          WHERE a.course_id = e.course_id
            AND sub.student_id = e.user_id
        ) AS assignments_done,

        -- ⭐ Số quiz đã làm
        (
          SELECT COUNT(*)
          FROM quiz_results qr
          JOIN quizzes q ON q.id = qr.quiz_id
          WHERE q.course_id = e.course_id
            AND qr.user_id = e.user_id
        ) AS quizzes_done

      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = $1
      ORDER BY u.full_name ASC
      `,
      [courseId]
    );

    const students = studentsRes.rows;

    // ==================================================
    // 🎨 5) Render giao diện dashboard
    // ==================================================
    return res.render("dashboard/course-students", {
      user,
      isAdmin,
      course,
      meta,
      students,
      courseId,
      currentPage: "instructor-courses",
    });

  } catch (err) {
    console.error("❌ viewCourseStudents error:", err);
    return res.status(500).send("Lỗi hệ thống khi tải danh sách học viên.");
  }
};


export const notifyStudent = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const instructorId = req.user.id;

    const msg = req.body.message || 
      "Giảng viên nhắc bạn tiếp tục hoàn thành khóa học!";

    await pool.query(`
      INSERT INTO notifications (user_id, course_id, message, type)
      VALUES ($1, $2, $3, 'instructor_push')
    `, [studentId, courseId, msg]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
};
// GET notifications for current user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.json([]);

    const q = await pool.query(`
      SELECT n.id, n.message, n.course_id, n.is_read, n.created_at,
             c.title AS course_title
      FROM notifications n
      LEFT JOIN courses c ON c.id = n.course_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [userId]);

    res.json(q.rows);
  } catch (err) {
    console.error("Notification error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE id = $1
    `, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
