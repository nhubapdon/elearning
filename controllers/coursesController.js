import pool from "../db.js";

/* ===========================================================
   🧩 1. DANH SÁCH KHÓA HỌC (6 / TRANG + DANH MỤC)
=========================================================== */
export const getAllCourses = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = 6;
    const offset = (page - 1) * perPage;

    const search = (req.query.search || "").trim();
    let params = [];
    let idx = 1;
    let where = "";

    if (search) {
      where = `WHERE c.title ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    // COUNT
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM courses c ${where}`, params
    );

    const totalItems = Number(countResult.rows[0].total || 0);
    const totalPages = Math.max(Math.ceil(totalItems / perPage), 1);
    const currentPage = Math.min(page, totalPages);

    // MAIN QUERY
    const listSql = `
      SELECT 
        c.*,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        COUNT(DISTINCT e.user_id) AS total_students,
        ARRAY_REMOVE(ARRAY_AGG(cat.name), NULL) AS categories
      FROM courses c
      LEFT JOIN reviews r ON r.course_id = c.id
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN course_categories cc ON cc.course_id = c.id
      LEFT JOIN categories cat ON cat.id = cc.category_id
      ${where}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const courses = (await pool.query(listSql, [...params, perPage, offset])).rows;

    res.render("courses/index", {
      courses,
      pagination: { page: currentPage, totalPages, totalItems, perPage, search },
      user: req.session.user || null,
    });

  } catch (err) {
    console.error("❌ Lỗi tải khóa học:", err);
    res.status(500).send("Lỗi server");
  }
};


/* ===========================================================
   🎥 2. CHI TIẾT KHÓA HỌC (FULL DATA) có cả quizzes
=========================================================== */
export const getCourseDetail = async (req, res) => {
  try {
    const courseId = req.params.id;
    const user = req.session.user || null;

    /** 1. Khóa học */
const courseRes = await pool.query(
  `SELECT 
      c.*, 
      u.full_name AS instructor_name
   FROM courses c
   LEFT JOIN users u ON u.id = c.instructor_id
   WHERE c.id = $1`,
  [courseId]
);
    if (courseRes.rows.length === 0) {
      return res.status(404).send("Không tìm thấy khóa học");
    }
    const course = courseRes.rows[0];

    /** 2. Danh mục khóa học */
    const categoriesRes = await pool.query(
      `SELECT cat.name 
       FROM categories cat
       JOIN course_categories cc ON cc.category_id = cat.id
       WHERE cc.course_id = $1`,
      [courseId]
    );
    course.categories = categoriesRes.rows.map((c) => c.name);

    /** 3. Bài học */
    const lessonsRes = await pool.query(
      `SELECT * 
       FROM lessons 
       WHERE course_id=$1 
       ORDER BY order_index ASC`,
      [courseId]
    );

    /** 4. Đánh giá */
    const reviewsRes = await pool.query(
      `SELECT r.*, u.full_name AS user_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.course_id=$1
       ORDER BY r.created_at DESC`,
      [courseId]
    );

/** 5. Quiz – Lấy đúng bài quiz của khóa học */
const quizRes = await pool.query(
  `SELECT * FROM quizzes WHERE course_id = $1 ORDER BY order_index ASC LIMIT 1`,
  [courseId]
);

let quiz = null;
let quizQuestions = [];
let lastQuizSubmission = null;
let userPassedQuiz = false;

if (quizRes.rows.length > 0) {
  quiz = quizRes.rows[0];

  // Lấy câu hỏi
  const qRes = await pool.query(
    `SELECT id, question, options, correct_index 
     FROM quiz_questions 
     WHERE quiz_id = $1 
     ORDER BY id ASC`,
    [quiz.id]
  );

  quizQuestions = qRes.rows;

  // Check user submission
  if (user) {
    const subRes = await pool.query(
      `SELECT * FROM quiz_submissions 
       WHERE quiz_id = $1 AND user_id = $2
       ORDER BY submitted_at DESC LIMIT 1`,
      [quiz.id, user.id]
    );

    if (subRes.rows.length > 0) {
      lastQuizSubmission = subRes.rows[0];
            // ⭐ NOW CHECK PASS HERE ( đúng lúc )
      if (lastQuizSubmission.score >= 80) {
        userPassedQuiz = true;
      }
    }
  }
}


    /** 6. Tài liệu lessons (lesson_materials) */
    const materialsRes = await pool.query(
      `SELECT *
       FROM lesson_materials
       WHERE lesson_id IN (
         SELECT id FROM lessons WHERE course_id = $1
       )
       ORDER BY id DESC`,
      [courseId]
    );
    const materials = materialsRes.rows;
    

    /** 7. Kiểm tra quyền xem (đã mua / role) */
    let enrolled = false;
    if (user) {
      if (user.role === "admin" || user.role === "instructor") {
        enrolled = true;
      } else {
        const check = await pool.query(
          `SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2`,
          [user.id, courseId]
        );
        if (check.rows.length > 0) enrolled = true;
      }
    }
/** 7.6. Lấy danh sách bài tập + trạng thái nộp */
let assignments = [];
if (enrolled) {
  const result = await pool.query(`
    SELECT 
      a.*, 
      s.id AS submission_id,
      s.score AS submitted_score,
      s.status AS submission_status
    FROM assignments a
    LEFT JOIN assignment_submissions s 
      ON s.assignment_id = a.id AND s.student_id = $1
    WHERE a.course_id = $2
    ORDER BY a.created_at DESC
  `, [user?.id || null, courseId]);

  assignments = result.rows;
}

   /** 7.5. Kiểm tra chứng chỉ (nếu đã cấp) */
    let certificate = null;
    if (user) {
      const certRes = await pool.query(
        `SELECT * FROM certificates WHERE user_id=$1 AND course_id=$2`,
        [user.id, courseId]
      );
      if (certRes.rows.length > 0) {
        certificate = certRes.rows[0];
      }
    }

    /** 8. Render view */
    res.render("courses/detail", {
      title: course.title,
      course,
      lessons: lessonsRes.rows,
      reviews: reviewsRes.rows,
      quizzes: quizRes.rows,
      quiz,
      quizQuestions,
      lastQuizSubmission,
      materials,
      user,
      enrolled,
      userPassedQuiz,
      certificate,
      assignments,
    });

  } catch (err) {
  console.error("❌ Lỗi chi tiết khóa học:", err);
  res.status(500).send("Lỗi server");
}

};
/* ===========================================================
   🎥 Thêm hàm submitQuiz
=========================================================== */
export const submitQuiz = async (req, res) => {
  try {
    const courseId = req.params.id;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để làm bài quiz."
      });
    }

    // Lấy quiz của khóa học
    const quizRes = await pool.query(
      `SELECT * FROM quizzes 
       WHERE course_id=$1 
       ORDER BY order_index ASC 
       LIMIT 1`,
      [courseId]
    );
    if (quizRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Khóa học này chưa có bài quiz."
      });
    }
    const quiz = quizRes.rows[0];

    // Lấy câu hỏi
    const questionsRes = await pool.query(
      `SELECT id, question, options, correct_index
       FROM quiz_questions
       WHERE quiz_id=$1
       ORDER BY id ASC`,
      [quiz.id]
    );
    const questions = questionsRes.rows;

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Quiz chưa có câu hỏi."
      });
    }

    // answers gửi lên dạng: { [questionId]: selectedIndex }
    const answers = req.body.answers || {};
    let correctCount = 0;

    const details = questions.map((q) => {
      const qid = q.id.toString();
      const selectedIndexRaw = answers[qid];
      const selectedIndex =
        selectedIndexRaw === null || selectedIndexRaw === undefined
          ? null
          : parseInt(selectedIndexRaw, 10);

      const isCorrect = selectedIndex === q.correct_index;
      if (isCorrect) correctCount++;

      return {
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
        selectedIndex,
        isCorrect
      };
    });

    const total = questions.length;
    const scorePercent = total > 0 ? (correctCount * 100) / total : 0;

    // Lưu submission
    const submissionRes = await pool.query(
      `INSERT INTO quiz_submissions (quiz_id, user_id, score)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [quiz.id, user.id, scorePercent.toFixed(2)]
    );

    // Lưu chi tiết
    await pool.query(
      `INSERT INTO quiz_results (quiz_id, user_id, score, details)
       VALUES ($1, $2, $3, $4)`,
      [quiz.id, user.id, Math.round(scorePercent), details]
    );

    return res.json({
      success: true,
      message: "Nộp bài thành công",
      score: scorePercent,
      correct: correctCount,
      total,
      submission: submissionRes.rows[0]
    });
  } catch (err) {
    console.error("❌ Lỗi nộp quiz:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi nộp bài quiz."
    });
  }
};



/* ===========================================================
   💳 3. ENROLL / MUA KHÓA HỌC
=========================================================== */
export const enrollCourse = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.id;

    const check = await pool.query(
      `SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId]
    );

    if (check.rows.length === 0) {
      await pool.query(
        `INSERT INTO enrollments (user_id, course_id, purchased_at)
         VALUES ($1, $2, NOW())`,
        [userId, courseId]
      );
    }

    res.redirect(`/courses/${courseId}`);
  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
    res.status(500).send("Lỗi server");
  }
};

// ===============================
// SAVE LESSON PROGRESS
// ===============================
export const saveLessonProgress = async (req, res) => {
  try {
    console.log("==============================================");
    console.log("📥 [DEBUG] SAVE LESSON PROGRESS HIT");
    console.log("Headers:", req.headers);
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("Session user:", req.session.user);

    const user = req.session?.user;
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Bạn cần đăng nhập" });
    }

    const userId = Number(user.id);
    const courseId = Number(req.params.courseId);
    const lessonId = Number(req.params.lessonId);

    let { currentSecond, completed } = req.body;

    // Ép kiểu an toàn
    currentSecond = parseInt(currentSecond ?? 0, 10);
    if (!Number.isFinite(currentSecond) || currentSecond < 0) {
      currentSecond = 0;
    }
    const lastSecond = currentSecond;
    completed = !!completed;

    console.log("➡ Parsed:", {
      userId,
      courseId,
      lessonId,
      lastSecond,
      completed,
    });

    // 1️⃣ Kiểm tra đã enroll hay chưa
    const enroll = await pool.query(
      `SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId]
    );
    console.log("➡ Enroll check:", enroll.rows);

    if (!enroll.rows.length) {
      return res
        .status(403)
        .json({ success: false, message: "Bạn chưa đăng ký khóa học này" });
    }

    // 2️⃣ Lưu / cập nhật tiến trình bài học (KHÔNG DÙNG ON CONFLICT NỮA)
    console.log("➡ RUN UPSERT lesson_progress (CTE)...");

    const upsertSql = `
      WITH updated AS (
        UPDATE lesson_progress
        SET 
          is_completed = $4,
          last_second  = $5
        WHERE enrollment_user_id   = $1
          AND enrollment_course_id = $2
          AND lesson_id            = $3
        RETURNING *
      )
      INSERT INTO lesson_progress (
        enrollment_user_id,
        enrollment_course_id,
        lesson_id,
        is_completed,
        last_second
      )
      SELECT $1, $2, $3, $4, $5
      WHERE NOT EXISTS (SELECT 1 FROM updated)
      RETURNING *;
    `;

    const result = await pool.query(upsertSql, [
      userId,
      courseId,
      lessonId,
      completed,
      lastSecond,
    ]);

    console.log("➡ SQL RESULT:", result.rows[0]);

    // 3️⃣ Cập nhật % hoàn thành khóa học
    console.log("➡ Updating progress_percent...");

    const updateEnroll = await pool.query(
      `
      UPDATE enrollments
      SET progress_percent = COALESCE((
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE is_completed = true)::decimal 
          / NULLIF((SELECT COUNT(*) FROM lessons WHERE course_id = $2), 0)::decimal) * 100
        , 2)
        FROM lesson_progress lp
        WHERE lp.enrollment_user_id   = $1
          AND lp.enrollment_course_id = $2
      ), 0)
      WHERE user_id = $1 AND course_id = $2
      RETURNING progress_percent;
      `,
      [userId, courseId]
    );

    console.log("➡ Updated Enrollment Progress:", updateEnroll.rows[0]);
    console.log("✅ SAVE LESSON PROGRESS COMPLETED");
    console.log("==============================================");

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ [DEBUG] ERROR in saveLessonProgress:", err);
    console.log("🔎 ERROR CODE:", err.code);
    console.log("🔎 ERROR DETAIL:", err.detail);
    console.log("🔎 ERROR CONSTRAINT:", err.constraint);

    return res.status(500).json({
      success: false,
      error: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
    });
  }
};

/* ===========================================================
   ⭐ 5. GỬI REVIEW
=========================================================== */
export const submitReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.session.user.id;
    const courseId = req.params.id;

    await pool.query(
      `INSERT INTO reviews (user_id, course_id, rating, comment) 
       VALUES ($1, $2, $3, $4)`,
      [userId, courseId, rating, comment]
    );

    res.redirect(`/courses/${courseId}#reviews`);
  } catch (err) {
    console.error("❌ Lỗi đánh giá:", err);
    res.status(500).send("Lỗi server");
  }
};
export const checkoutCourse = async (req, res) => {
  try {
    const user = req.session.user;
    const courseId = req.params.id;

    // Thêm khóa học vào giỏ
    await pool.query(
      `INSERT INTO cart_items (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, courseId]
    );

    res.redirect("/checkout");

  } catch (err) {
    console.error("❌ Lỗi checkout:", err);
    res.status(500).send("Lỗi máy chủ");
  }
};
export const addToCart = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      // Nếu là AJAX thì trả JSON, không thì redirect login
      if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
        return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
      }
      return res.redirect("/signin");
    }

    const courseId = req.params.id;

    await pool.query(
      `INSERT INTO cart_items (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, courseId]
    );

    // Nếu là AJAX → trả JSON để hiện popup
    if (
      req.xhr ||
      req.headers["x-requested-with"] === "XMLHttpRequest" ||
      (req.headers.accept || "").includes("application/json")
    ) {
      return res.json({ success: true, message: "Đã thêm khóa học vào giỏ hàng" });
    }

    // Nếu không phải AJAX → chuyển sang giỏ
    res.redirect("/cart");
  } catch (err) {
    console.error("❌ Lỗi thêm vào giỏ hàng:", err);
    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
    }
    res.status(500).send("Lỗi máy chủ");
  }
};
