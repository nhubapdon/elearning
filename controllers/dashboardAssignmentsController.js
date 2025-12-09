// controllers/dashboardAssignmentsController.js
import pool from "../db.js";

/**
 * Middleware check instructor hoặc admin (giống requireInstructorOrAdmin) :contentReference[oaicite:3]{index=3}
 * Ở routes ta sẽ dùng requireInstructorOrAdmin từ middleware/auth.js luôn cho chuẩn.
 */

/**
 * Danh sách assignment theo khoá của giảng viên
 * GET /dashboard/assignments
 * query: course_id (optional)
 */
export const listAssignmentsManage = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.redirect("/signin");

    const isAdmin = user.role === "admin";

    // Load khoá học mà giảng viên phụ trách / admin full
    let courses;
    if (isAdmin) {
      courses = (await pool.query(
        `SELECT id, title FROM courses ORDER BY title ASC`
      )).rows;
    } else {
      courses = (await pool.query(
        `SELECT id, title FROM courses WHERE instructor_id=$1 ORDER BY title ASC`,
        [user.id]
      )).rows;
    }

    const selectedCourseId = req.query.course_id || (courses[0]?.id || null);

    let assignments = [];
    if (selectedCourseId) {
      // Nếu là instructor thì khoá đó phải của họ
      if (!isAdmin) {
        const ownCourse = await pool.query(
          `SELECT 1 FROM courses WHERE id=$1 AND instructor_id=$2`,
          [selectedCourseId, user.id]
        );
        if (!ownCourse.rows.length) {
          return res.status(403).send("Bạn không có quyền với khoá học này.");
        }
      }

      const assRes = await pool.query(
        `
        SELECT a.*,
               COUNT(s.*) AS submission_count
        FROM assignments a
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
        WHERE a.course_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC
        `,
        [selectedCourseId]
      );
      assignments = assRes.rows;
    }

    res.render("dashboard/assignments/index", {
      user,
      isAdmin,
      courses,
      assignments,
      selectedCourseId,
    });
  } catch (err) {
    console.error("❌ listAssignmentsManage:", err);
    res.status(500).send("Lỗi server.");
  }
};

/**
 * Form tạo assignment
 * GET /dashboard/assignments/create?course_id=xx
 */
export const renderCreateAssignmentForm = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";
    let courses;

    if (isAdmin) {
      courses = (await pool.query(
        `SELECT id, title FROM courses ORDER BY title ASC`
      )).rows;
    } else {
      courses = (await pool.query(
        `SELECT id, title FROM courses WHERE instructor_id=$1 ORDER BY title ASC`,
        [user.id]
      )).rows;
    }

    res.render("dashboard/assignments/create", {
      user,
      isAdmin,
      courses,
      defaultCourseId: req.query.course_id || "",
    });
  } catch (err) {
    console.error("❌ renderCreateAssignmentForm:", err);
    res.status(500).send("Lỗi server.");
  }
};

/**
 * Xử lý tạo assignment
 * POST /dashboard/assignments/create
 */
export const createAssignment = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";

    const { course_id, title, description, due_date, max_score, allow_late } =
      req.body;

    // Nếu instructor → phải là khoá của họ
    if (!isAdmin) {
      const ownCourse = await pool.query(
        `SELECT 1 FROM courses WHERE id=$1 AND instructor_id=$2`,
        [course_id, user.id]
      );
      if (!ownCourse.rows.length) {
        return res.status(403).send("Bạn không có quyền tạo cho khoá này.");
      }
    }

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = "/uploads/assignments/" + req.file.filename;
    }

    await pool.query(
      `
      INSERT INTO assignments
        (course_id, title, description, attachment_url,
         due_date, max_score, allow_late, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        course_id,
        title,
        description || null,
        attachmentUrl,
        due_date || null,
        max_score || 100,
        allow_late === "on" || allow_late === "true",
        user.id,
      ]
    );

    res.redirect(`/dashboard/assignments?course_id=${course_id}`);
  } catch (err) {
    console.error("❌ createAssignment:", err);
    res.status(500).send("Lỗi server.");
  }
};

/**
 * Danh sách bài nộp của 1 assignment
 * GET /dashboard/assignments/:id/submissions
 */
export const listSubmissionsForAssignment = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";
    const { id } = req.params;

    // Lấy assignment + course
    const assRes = await pool.query(
      `
      SELECT a.*, c.title AS course_title, c.instructor_id
      FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = $1
      `,
      [id]
    );
    if (!assRes.rows.length) return res.status(404).send("Không tìm thấy bài tập.");
    const assignment = assRes.rows[0];

    // Permission
    if (!isAdmin && assignment.instructor_id !== user.id) {
      return res.status(403).send("Bạn không có quyền với bài tập này.");
    }

    // Lấy submissions
    const subRes = await pool.query(
      `
      SELECT 
        s.*,
        u.full_name AS student_name,
        u.email AS student_email
      FROM assignment_submissions s
      JOIN users u ON u.id = s.student_id
      WHERE s.assignment_id = $1
      ORDER BY s.submitted_at DESC
      `,
      [id]
    );

    res.render("dashboard/assignments/submissions", {
      user,
      assignment,
      submissions: subRes.rows,
    });
  } catch (err) {
    console.error("❌ listSubmissionsForAssignment:", err);
    res.status(500).send("Lỗi server.");
  }
};

/**
 * Chấm điểm 1 bài nộp
 * POST /dashboard/assignments/submissions/:submissionId/grade
 */
export const gradeSubmission = async (req, res) => {
  try {
    const user = req.session.user;
    const isAdmin = user.role === "admin";
    const { submissionId } = req.params;
    const { score, feedback } = req.body;

    // Lấy submission + assignment + course
    const subRes = await pool.query(
      `
      SELECT s.*, a.course_id, c.instructor_id
      FROM assignment_submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN courses c ON c.id = a.course_id
      WHERE s.id = $1
      `,
      [submissionId]
    );
    if (!subRes.rows.length) {
      return res.status(404).send("Không tìm thấy bài nộp.");
    }
    const submission = subRes.rows[0];

    if (!isAdmin && submission.instructor_id !== user.id) {
      return res.status(403).send("Bạn không có quyền chấm bài này.");
    }

    await pool.query(
      `
      UPDATE assignment_submissions
      SET score=$1,
          feedback=$2,
          graded_at=NOW(),
          graded_by=$3,
          status='graded'
      WHERE id=$4
      `,
      [score || null, feedback || null, user.id, submissionId]
    );

    res.redirect(`/dashboard/assignments/${submission.assignment_id}/submissions`);
  } catch (err) {
    console.error("❌ gradeSubmission:", err);
    res.status(500).send("Lỗi server.");
  }
};
