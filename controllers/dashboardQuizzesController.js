import pool from "../db.js";
import xlsx from "xlsx";
import { Parser as CsvParser } from "json2csv";
import fs from "fs";
import path from "path";
// =============================
// ROLE CHECKER
// =============================
function canAccessQuiz(user, quizOwnerInstructorId) {
  if (!user) return false;

  if (user.role === "admin") return true;

  if (user.role === "instructor" && user.id === quizOwnerInstructorId) return true;

  return false;
}

// =============================
// 1. LIST QUIZZES (with filter + pagination + search)
// =============================
export const listQuizzes = async (req, res) => {
  try {
    const user = req.session.user;

    let { page = 1, limit = 10, search = "", course_id = "" } = req.query;
    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Filtering conditions
    let conditions = [];
    let params = [];
    let idx = 1;

    if (search) {
      conditions.push(`q.title ILIKE $${idx}`);
      params.push(`%${search}%`);
      idx++;
    }

    if (course_id) {
      conditions.push(`q.course_id = $${idx}`);
      params.push(course_id);
      idx++;
    }

    // Instructor only sees quizzes from THEIR courses
    if (user.role === "instructor") {
      conditions.push(`c.instructor_id = $${idx}`);
      params.push(user.id);
      idx++;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ⭐⭐⭐ FIX: COUNT số câu hỏi bằng LEFT JOIN quiz_questions
    const sql = `
      SELECT 
        q.id,
        q.title,
        q.course_id,
        q.created_at,
        c.title AS course_title,
        c.instructor_id,
        COUNT(qq.id) AS question_count
      FROM quizzes q
      JOIN courses c ON c.id = q.course_id
      LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
      ${where}
      GROUP BY q.id, c.id
      ORDER BY q.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const quizzesRes = await pool.query(sql, params);

    // Count total (không dùng GROUP BY)
    const countRes = await pool.query(
      `
      SELECT COUNT(*) FROM quizzes q
      JOIN courses c ON c.id = q.course_id
      ${where}
    `,
      params
    );

    const total = Number(countRes.rows[0].count);

    // Load courses for filter
    const courses = await pool.query(
      "SELECT id, title FROM courses ORDER BY title ASC"
    );

    res.render("admin/quizzes/index", {
      quizzes: quizzesRes.rows,
      courses: courses.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      filters: {
        search,
        course_id,
      }
    });
  } catch (err) {
    console.error("❌ listQuizzes error:", err);
    res.status(500).send("Server error");
  }
};


// =============================
// 2. SHOW CREATE QUIZ FORM
// =============================
export const showCreateForm = async (req, res) => {
  try {
    const user = req.session.user;

    let courses;

    // Admin xem tất cả khóa học – GIỮ NGUYÊN LOGIC
    if (user.role === "admin") {
      courses = await pool.query(`
        SELECT id, title 
        FROM courses 
        ORDER BY title ASC
      `);
    } 
    // Instructor chỉ xem khóa học mình phụ trách – GIỮ NGUYÊN LOGIC
    else {
      courses = await pool.query(
        `SELECT id, title FROM courses WHERE instructor_id = $1`,
        [user.id]
      );
    }

    // ⭐⭐⭐ THÊM ĐẦY ĐỦ DỮ LIỆU FORM
    res.render("admin/quizzes/form", {
      mode: "create",   // ⭐ BẮT BUỘC
      courses: courses.rows,
      quiz: null,       // ⭐ ĐỂ form.ejs không lỗi
      questions: []     // ⭐ Bắt buộc để tránh lỗi undefined
    });

  } catch (err) {
    console.error("❌ showCreateForm:", err);
    res.status(500).send("Server error");
  }
};


// =============================
// 3. CREATE QUIZ
// =============================
export const createQuiz = async (req, res) => {
  try {
    const { title, course_id } = req.body;
    const user = req.session.user;

    // questions là STRING JSON -> cần parse
    let questions = [];
    try {
      questions = JSON.parse(req.body.questions || "[]");
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      return res.status(400).send("Dữ liệu câu hỏi không hợp lệ.");
    }

    // Check permission
    const courseRes = await pool.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [course_id]
    );

    if (!courseRes.rows[0] || !canAccessQuiz(user, courseRes.rows[0].instructor_id)) {
      return res.status(403).send("Bạn không có quyền tạo quiz cho khóa học này.");
    }

    // Insert quiz
    const quizRes = await pool.query(
      `INSERT INTO quizzes (title, course_id)
       VALUES ($1, $2) RETURNING id`,
      [title, course_id]
    );

    const quizId = quizRes.rows[0].id;

    // Insert questions
    for (const q of questions) {
      if (!q.question || !Array.isArray(q.options)) continue;

      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_index)
         VALUES ($1, $2, $3, $4)`,
        [
          quizId,
          q.question,
          JSON.stringify(q.options),
          Number(q.correct_index ?? 0)
        ]
      );
    }

    res.redirect("/admin/quizzes");

  } catch (err) {
    console.error("❌ createQuiz:", err);
    res.status(500).send("Server error");
  }
};


// =============================
// 4. SHOW EDIT FORM
// =============================
export const showEditForm = async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.session.user;

    // Lấy quiz + instructor_id
    const quizRes = await pool.query(
      `SELECT q.*, c.instructor_id
       FROM quizzes q
       JOIN courses c ON c.id = q.course_id
       WHERE q.id = $1`,
      [id]
    );

    if (quizRes.rows.length === 0)
      return res.status(404).send("Quiz không tồn tại");

    const quiz = quizRes.rows[0];

    // Kiểm tra quyền sửa quiz – GIỮ NGUYÊN LOGIC
    if (!canAccessQuiz(user, quiz.instructor_id))
      return res.status(403).send("Bạn không có quyền sửa quiz này.");

    // Lấy danh sách câu hỏi
    const questionsRes = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY id ASC`,
      [id]
    );

    // Admin có tất cả khóa học – GIỮ NGUYÊN LOGIC
    // Instructor chỉ thấy khóa học của mình – GIỮ NGUYÊN LOGIC
    let courses;
    if (user.role === "admin") {
      courses = await pool.query(`SELECT id, title FROM courses ORDER BY title ASC`);
    } else {
      courses = await pool.query(
        `SELECT id, title FROM courses WHERE instructor_id = $1`,
        [user.id]
      );
    }

    // ⭐⭐⭐ RENDER FORM ĐẦY ĐỦ
    res.render("admin/quizzes/form", {
      mode: "edit",               // ⭐ BẮT BUỘC
      quiz,
      questions: questionsRes.rows,
      courses: courses.rows
    });

  } catch (err) {
    console.error("❌ showEditForm:", err);
    res.status(500).send("Server error");
  }
};


// =============================
// 5. UPDATE QUIZ
// =============================
// =============================
// UPDATE QUIZ (CHUẨN)
// =============================
export const updateQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    const user = req.session.user;

    const { title, course_id } = req.body;

    // Parse JSON từ hidden field
    let questions = [];
    try {
      questions = JSON.parse(req.body.questions || "[]");
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      return res.status(400).send("Dữ liệu câu hỏi không hợp lệ");
    }

    // Lọc câu hỏi rỗng (phòng khi JS chưa lọc hết)
    questions = questions.filter(q =>
      q.question &&
      q.question.trim() !== "" &&
      Array.isArray(q.options)
    );

    if (questions.length === 0) {
      return res.status(400).send("Bài kiểm tra phải có ít nhất 1 câu hỏi.");
    }

    // Kiểm tra quyền sửa
    const quizOwnerRes = await pool.query(
      `SELECT c.instructor_id 
       FROM quizzes q 
       JOIN courses c ON c.id = q.course_id
       WHERE q.id = $1`,
      [quizId]
    );

    if (
      !quizOwnerRes.rows.length ||
      !canAccessQuiz(user, quizOwnerRes.rows[0].instructor_id)
    ) {
      return res.status(403).send("Bạn không có quyền sửa quiz này.");
    }

    // Cập nhật quiz
    await pool.query(
      `UPDATE quizzes
       SET title = $1
       WHERE id = $2`,
      [title, quizId]
    );

    // Xóa hết câu hỏi cũ
    await pool.query(`DELETE FROM quiz_questions WHERE quiz_id = $1`, [quizId]);

    // Thêm câu hỏi mới
    for (const q of questions) {
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_index)
         VALUES ($1, $2, $3, $4)`,
        [
          quizId,
          q.question,
          JSON.stringify(q.options),
          q.correct_index
        ]
      );
    }

    res.redirect("/admin/quizzes");
  } catch (err) {
    console.error("❌ updateQuiz:", err);
    res.status(500).send("Server error");
  }
};


// =============================
// 6. DELETE QUIZ
// =============================
export const deleteQuiz = async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.session.user;

    const quizRes = await pool.query(
      `SELECT q.*, c.instructor_id
       FROM quizzes q
       JOIN courses c ON c.id = q.course_id
       WHERE q.id = $1`,
      [id]
    );

    if (!quizRes.rows.length || !canAccessQuiz(user, quizRes.rows[0].instructor_id))
      return res.status(403).send("Bạn không có quyền xoá quiz này.");

    await pool.query("DELETE FROM quizzes WHERE id=$1", [id]);

    res.redirect("/admin/quizzes");
  } catch (err) {
    console.error("❌ deleteQuiz:", err);
    res.status(500).send("Server error");
  }
};

// =============================
// 7. EXPORT CSV
// =============================
export const exportQuizzesCsv = async (req, res) => {
  try {
    const user = req.session.user;

    let condition = "";
    let params = [];

    if (user.role === "instructor") {
      condition = "WHERE c.instructor_id = $1";
      params = [user.id];
    }

    const sql = `
      SELECT q.id, q.title, c.title AS course_title
      FROM quizzes q
      JOIN courses c ON c.id = q.course_id
      ${condition}
      ORDER BY q.id DESC
    `;

    const result = await pool.query(sql, params);

    const csv = new CsvParser({ fields: ["id", "title", "course_title"] }).parse(result.rows);

    res.header("Content-Type", "text/csv");
    res.attachment("quizzes.csv");
    return res.send(csv);
  } catch (err) {
    console.error("❌ exportQuizzesCsv:", err);
    res.status(500).send("Server error");
  }
};

// =============================
// 8. IMPORT QUIZZES (Excel) — BẢN NÂNG CẤP HOÀN CHỈNH
// =============================
export const importQuizzesExcel = async (req, res) => {
  try {
    const user = req.session.user;

    if (!req.file) {
      return res.status(400).send("Không tìm thấy file Excel.");
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    // Tải danh sách khóa học cho fuzzy match
    const courseList = await pool.query(
      "SELECT id, title, instructor_id FROM courses"
    );

    // Hàm fuzzy match
    const fuzzyMatch = (a, b) => {
      if (!a || !b) return false;
      a = a.toLowerCase().trim();
      b = b.toLowerCase().trim();
      return a === b || a.includes(b) || b.includes(a);
    };

    let currentQuizId = null;
    let currentQuizTitle = null;

    for (const row of rows) {
      if (!row.title) continue;
      if (!row.question) continue;

      const title = row.title;
      const question = row.question;
      let course_id = row.course_id || null;
      const course_title = row.course_title || null;
      const correct_index = Number(row.correct_index) || 0;

      // ==== XỬ LÝ OPTIONS THÔNG MINH ====
      let options = [];

      const optKeys = Object.keys(row).filter(k =>
        k.toLowerCase().startsWith("option_")
      );

      if (optKeys.length > 0) {
        options = optKeys
          .sort()
          .map(k => row[k])
          .filter(Boolean);
      } else if (row.options) {
        options = row.options
          .split("|")
          .map(o => o.trim())
          .filter(o => o.length > 0);
      }

      if (options.length === 0) continue;

      // ===========================
      // TÌM COURSE ID
      // ===========================

      let matchedCourse = null;

      // CASE 1: Có course_id → ưu tiên dùng
      if (course_id) {
        matchedCourse = courseList.rows.find(c => c.id == course_id);
      }

      // CASE 2: Không có course_id → tìm theo tên khóa học
      if (!matchedCourse && course_title) {
        matchedCourse = courseList.rows.find(c =>
          fuzzyMatch(c.title, course_title)
        );
      }

      // CASE 3: Không tìm được khóa học → bỏ qua
      if (!matchedCourse) {
        console.log("⛔ Không tìm thấy khóa học tương ứng cho:", row);
        continue;
      }

      // CASE 4: Kiểm tra quyền admin / instructor
      if (!canAccessQuiz(user, matchedCourse.instructor_id)) {
        console.log("⛔ Không có quyền import vào khóa học:", matchedCourse.title);
        continue;
      }

      // ===========================
      // TẠO QUIZ (nếu là quiz mới)
      // ===========================
      if (title !== currentQuizTitle) {
        const quizRes = await pool.query(
          `INSERT INTO quizzes (title, course_id)
           VALUES ($1, $2)
           RETURNING id`,
          [title, matchedCourse.id]
        );

        currentQuizId = quizRes.rows[0].id;
        currentQuizTitle = title;
      }

      // ===========================
      // THÊM CÂU HỎI
      // ===========================
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_index)
         VALUES ($1, $2, $3, $4)`,
        [currentQuizId, question, JSON.stringify(options), correct_index]
      );
    }

    res.redirect("/admin/quizzes");
  } catch (err) {
    console.error("❌ importQuizzesExcel:", err);
    res.status(500).send("Server error");
  }
};




// =============================
// 9. PREVIEW QUIZ — AJAX RETURN HTML
// =============================
export const previewQuiz = (req, res) => {
  try {
    const { title, questions } = req.body;

    // Render EJS ra HTML chuỗi thay vì gửi thẳng trang
    res.render(
      "admin/quizzes/preview",
      { title, questions },
      (err, html) => {
        if (err) {
          console.error("❌ Preview render error:", err);
          return res.status(500).json({ success: false });
        }

        // Trả HTML để JS gắn vào modal
        res.json({
          success: true,
          html
        });
      }
    );
  } catch (err) {
    console.error("❌ previewQuiz:", err);
    res.status(500).json({ success: false });
  }
};

// =============================
// 10. EXPORT EXCEL TEMPLATE
// =============================
export const exportQuizTemplate = async (req, res) => {
  try {
    // Lấy danh sách khóa học
    const coursesRes = await pool.query(
      "SELECT id, title FROM courses ORDER BY title ASC"
    );

    // ===== SHEET 1: quizzes =====
    const quizSample = [
      {
        title: "Tên bài kiểm tra",
        course_title: "Tên khóa học (vd: Giao tiếp xã hội)",
        question: "Câu hỏi mẫu?",
        option_1: "Đáp án A",
        option_2: "Đáp án B",
        option_3: "Đáp án C",
        option_4: "Đáp án D",
        correct_index: 0
      }
    ];

    // ===== SHEET 2: courses =====
    const courseSheet = coursesRes.rows.map(c => ({
      id: c.id,
      title: c.title
    }));

    const wb = xlsx.utils.book_new();

    const ws1 = xlsx.utils.json_to_sheet(quizSample);
    const ws2 = xlsx.utils.json_to_sheet(courseSheet);

    xlsx.utils.book_append_sheet(wb, ws1, "quizzes");
    xlsx.utils.book_append_sheet(wb, ws2, "courses");

    const filePath = path.join("tmp", "quiz_import_template.xlsx");
    xlsx.writeFile(wb, filePath);

    res.download(filePath, "mau_import_quiz.xlsx", () => {
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error("❌ exportQuizTemplate:", err);
    res.status(500).send("Server error");
  }
};
// =============================
// QUIZ DETAIL (JSONB-based)
// =============================
export const quizDetail = async (req, res) => {
  try {
    const quizId = req.params.id;

    // Lấy thông tin quiz + khóa học
    const quizRes = await pool.query(
      `SELECT q.*, c.title AS course_title
       FROM quizzes q
       JOIN courses c ON c.id = q.course_id
       WHERE q.id = $1`,
      [quizId]
    );

    if (!quizRes.rows.length) {
      return res.status(404).send("Quiz không tồn tại");
    }

    const quiz = quizRes.rows[0];

    // Lấy danh sách kết quả làm bài
    const resultsRes = await pool.query(
      `SELECT r.*, u.full_name
       FROM quiz_results r
       JOIN users u ON u.id = r.user_id
       WHERE r.quiz_id = $1
       ORDER BY r.taken_at DESC`,
      [quizId]
    );

    const results = resultsRes.rows;
    const totalAttempts = results.length;

    let avgScore = 0;
    if (totalAttempts > 0) {
      avgScore = (
        results.reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
      ).toFixed(2);
    }

// Lấy toàn bộ câu hỏi để map lại options
const allQuestionsRes = await pool.query(
  `SELECT id, question, options
   FROM quiz_questions
   WHERE quiz_id = $1`,
  [quizId]
);

const questionMap = {};
allQuestionsRes.rows.forEach(q => {
  questionMap[q.id] = q.options; // options từ DB là mảng JSON
});

// Chuẩn hoá dữ liệu từ JSONB details
const detailedResults = results.map((r) => {
  let details = Array.isArray(r.details) ? r.details : [];

  details = details.map(d => {
    const optionsFromDB = questionMap[d.questionId] || [];

    return {
      questionId: d.questionId,
      question: d.question,
      options: optionsFromDB,              // ⭐ KHÔNG CÒN BỊ RỖNG NỮA
      correctIndex: d.correctIndex,
      correctText: d.correctText,
      userIndex: typeof d.userIndex === "number" ? d.userIndex : null,
      userAnswerText: d.userAnswerText,
      isCorrect: d.isCorrect
    };
  });

  const correctCount = details.filter(d => d.isCorrect).length;
  const totalQuestions = details.length;

  return {
    id: r.id,
    user: r.full_name,
    score: r.score,
    taken_at: r.taken_at,
    details,
    correctCount,
    totalQuestions
  };
});

    // Thống kê thêm: pass/fail + phân bố điểm
    let passCount = 0;
    const buckets = { "0_49": 0, "50_79": 0, "80_100": 0 };

    detailedResults.forEach((r) => {
      const s = Number(r.score) || 0;

      if (s >= 80) passCount++;

      if (s < 50) buckets["0_49"]++;
      else if (s < 80) buckets["50_79"]++;
      else buckets["80_100"]++;
    });

    const stats = {
      total: totalAttempts,
      passCount,
      failCount: totalAttempts - passCount,
      passRate:
        totalAttempts > 0
          ? ((passCount / totalAttempts) * 100).toFixed(1)
          : 0,
      buckets,
    };

    res.render("admin/quizzes/detail", {
      quiz,
      totalAttempts,
      avgScore,
      detailedResults,
      stats,
    });
  } catch (err) {
    console.error("❌ quizDetail:", err);
    res.status(500).send("Server error");
  }
};


