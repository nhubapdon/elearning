// controllers/assignmentsController.js
import pool from "../db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

/**
 * Danh sách assignment của 1 khóa học (student view)
 * GET /assignments/course/:courseId
 */
export const listAssignmentsForCourse = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.redirect("/signin");

    const { courseId } = req.params;

    // Kiểm tra đã đăng ký khoá học chưa (trừ admin/instructor)
    if (user.role === "student") {
      const enrollRes = await pool.query(
        `SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2`,
        [user.id, courseId]
      );
      if (!enrollRes.rows.length) {
        return res.status(403).send("Bạn chưa đăng ký khóa học này.");
      }
    }

    // Khóa học
    const courseRes = await pool.query(
      `SELECT * FROM courses WHERE id=$1`,
      [courseId]
    );
    if (!courseRes.rows.length) {
      return res.status(404).send("Không tìm thấy khóa học.");
    }

    // Danh sách assignments + trạng thái nộp của user
    const assignmentsRes = await pool.query(
      `
      SELECT 
        a.*,
        s.id AS submission_id,
        s.status AS submission_status,
        s.score AS submission_score,
        s.submitted_at
      FROM assignments a
      LEFT JOIN assignment_submissions s
        ON s.assignment_id = a.id AND s.student_id = $1
      WHERE a.course_id = $2
      ORDER BY a.due_date NULLS LAST, a.created_at DESC
      `,
      [user.id, courseId]
    );

    res.render("courses/assignments", {
      user,
      course: courseRes.rows[0],
      assignments: assignmentsRes.rows,
    });
  } catch (err) {
    console.error("❌ listAssignmentsForCourse:", err);
    res.status(500).send("Lỗi server khi tải danh sách bài tập.");
  }
};

/**
 * Chi tiết assignment + form nộp bài
 * GET /assignments/:id
 */
export const getAssignmentDetail = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.redirect("/signin");

    const { id } = req.params;

    const assRes = await pool.query(
      `
      SELECT a.*, c.title AS course_title, c.id AS course_id
      FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = $1
      `,
      [id]
    );
    if (!assRes.rows.length) return res.status(404).send("Không tìm thấy bài tập.");

    const assignment = assRes.rows[0];

    // Check enroll
    if (user.role === "student") {
      const enrollRes = await pool.query(
        `SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2`,
        [user.id, assignment.course_id]
      );
      if (!enrollRes.rows.length) {
        return res.status(403).send("Bạn chưa đăng ký khóa học này.");
      }
    }

    // Lấy submission gần nhất của user
    const subRes = await pool.query(
      `
      SELECT *
      FROM assignment_submissions
      WHERE assignment_id=$1 AND student_id=$2
      ORDER BY submitted_at DESC
      LIMIT 1
      `,
      [id, user.id]
    );

    const submission = subRes.rows[0] || null;

    res.render("courses/assignment-detail", {
      user,
      assignment,
      submission,
    });
  } catch (err) {
    console.error("❌ getAssignmentDetail:", err);
    res.status(500).send("Lỗi server khi tải chi tiết bài tập.");
  }
};

/**
 * Nộp bài (upload file)
 * POST /assignments/:id/submit
 * body: note (optional), file (field: file)
 */
export const submitAssignment = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.redirect("/signin");

    const { id } = req.params;
    const { note } = req.body;

    // Check assignment tồn tại
    const assRes = await pool.query(
      `SELECT * FROM assignments WHERE id=$1`,
      [id]
    );
    if (!assRes.rows.length)
      return res.status(404).send("Không tìm thấy bài tập.");

    const assignment = assRes.rows[0];

    // Check enrolled
    if (user.role === "student") {
      const enrollRes = await pool.query(
        `SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2`,
        [user.id, assignment.course_id]
      );
      if (!enrollRes.rows.length) {
        return res.status(403).send("Bạn chưa đăng ký khóa học này.");
      }
    }

    // ╔══════════════════════════════════════╗
    // 🔥 Upload file lên Cloudinary
    // ╚══════════════════════════════════════╝
    if (!req.file) {
      return res.status(400).send("Vui lòng chọn file để nộp.");
    }

    const fileUrl = await uploadToCloudinary(req.file.path, "submissions");

    if (!fileUrl) {
      return res.status(500).send("Không thể upload file. Vui lòng thử lại.");
    }

    // Kiểm tra submission cũ → resubmit
    const existingRes = await pool.query(
      `
      SELECT * FROM assignment_submissions
      WHERE assignment_id=$1 AND student_id=$2
      LIMIT 1
      `,
      [id, user.id]
    );

    if (existingRes.rows.length) {
      await pool.query(
        `
        UPDATE assignment_submissions
        SET file_url=$1,
            note=$2,
            submitted_at=NOW(),
            status='resubmitted',
            score=NULL,
            feedback=NULL,
            graded_at=NULL,
            graded_by=NULL
        WHERE assignment_id=$3 AND student_id=$4
        `,
        [fileUrl, note || null, id, user.id]
      );
    } else {
      await pool.query(
        `
        INSERT INTO assignment_submissions
          (assignment_id, student_id, file_url, note, status)
        VALUES ($1,$2,$3,$4,'submitted')
        `,
        [id, user.id, fileUrl, note || null]
      );
    }

    res.redirect(`/assignments/${id}`);
  } catch (err) {
    console.error("❌ submitAssignment:", err);
    res.status(500).send("Lỗi server khi nộp bài.");
  }
};
export const listAllAssignmentsOfUser = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.redirect("/signin");

    let page = Number(req.query.page || 1);
    let limit = 6;
    let offset = (page - 1) * limit;

    const countRes = await pool.query(`
      SELECT COUNT(*) 
      FROM assignment_submissions 
      WHERE student_id = $1
    `, [user.id]);

    const total = Number(countRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const sql = `
      SELECT 
        a.id AS assignment_id,
        a.title AS assignment_title,
        a.max_score,
        a.due_date,
        c.id AS course_id,
        c.title AS course_title,
        s.file_url,
        s.submitted_at,
        s.score,
        s.feedback,
        s.status
      FROM assignment_submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN courses c ON c.id = a.course_id
      WHERE s.student_id = $1
      ORDER BY s.submitted_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(sql, [user.id, limit, offset]);

    res.json({
      success: true,
      assignments: rows,
      page,
      totalPages
    });

  } catch (err) {
    console.error("❌ listAllAssignmentsOfUser:", err);
    res.status(500).json({ success: false });
  }
};

