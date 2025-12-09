// controllers/quizzesController.js
import pool from '../db.js';

/**
 * GET /quizzes/:courseId/start
 * Hiển thị giao diện làm quiz cho 1 khóa học (1 quiz/cuối khóa)
 */
export const startQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Lấy quiz của khóa học
    const quizRes = await pool.query(
      `SELECT * 
       FROM quizzes 
       WHERE course_id = $1 
       ORDER BY order_index ASC 
       LIMIT 1`,
      [courseId]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).send("Khoá học này chưa có bài Quiz.");
    }

    const quiz = quizRes.rows[0];

    // Lấy danh sách câu hỏi của quiz
    const questionsRes = await pool.query(
      `SELECT id, question, options, correct_index
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY id ASC`,
      [quiz.id]
    );

    const questions = questionsRes.rows;

    // Render view (đặt file ở: views/quizzes/quiz.ejs)
    res.render("courses/quiz", {
      quiz,
      questions,
    });
  } catch (err) {
    console.error("❌ Lỗi startQuiz:", err);
    res.status(500).send("Lỗi server");
  }
};

/**
 * POST /quizzes/:courseId/submit
 * Body: { answers: { [questionId]: selectedIndex } }
 * Trả về JSON kết quả + lưu vào quiz_results & quiz_submissions
 */
export const submitQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body || {};

    const user = req.session.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để nộp bài quiz.",
      });
    }

    // Lấy quiz theo course
    const quizRes = await pool.query(
      `SELECT * 
       FROM quizzes 
       WHERE course_id = $1 
       ORDER BY order_index ASC 
       LIMIT 1`,
      [courseId]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quiz cho khoá học này.",
      });
    }

    const quiz = quizRes.rows[0];

    // Lấy toàn bộ câu hỏi của quiz
    const questionsRes = await pool.query(
      `SELECT id, question, options, correct_index
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY id ASC`,
      [quiz.id]
    );

    const questions = questionsRes.rows;
    const total = questions.length;

    if (!total) {
      return res.json({
        success: true,
        score: 0,
        correct: 0,
        total: 0,
        details: [],
      });
    }

    let correctCount = 0;
    const details = [];

    for (const q of questions) {
      const qId = q.id;
      const userIndexRaw = answers ? answers[qId] : undefined;
      const userIndex =
        userIndexRaw === undefined ? null : Number(userIndexRaw);

      const isCorrect =
        userIndex !== null && userIndex === Number(q.correct_index);

      if (isCorrect) correctCount++;

      const options = Array.isArray(q.options) ? q.options : [];

      details.push({
        questionId: qId,
        question: q.question,
        correctIndex: q.correct_index,
        correctText:
          q.correct_index != null && options[q.correct_index] != null
            ? options[q.correct_index]
            : null,
        userIndex,
        userAnswerText:
          userIndex != null && options[userIndex] != null
            ? options[userIndex]
            : null,
        isCorrect,
      });
    }

    const score =
      total === 0 ? 0 : Math.round((correctCount / total) * 100 * 10) / 10; // 1 chữ số thập phân

    // Lưu vào quiz_results (chi tiết) và quiz_submissions (tổng quan)
    await pool.query(
      `INSERT INTO quiz_results (quiz_id, user_id, score, details)
       VALUES ($1, $2, $3, $4)`,
      [quiz.id, user.id, score, JSON.stringify(details)]
    );

    await pool.query(
      `INSERT INTO quiz_submissions (quiz_id, user_id, score)
       VALUES ($1, $2, $3)`,
      [quiz.id, user.id, score]
    );

    return res.json({
      success: true,
      score,
      correct: correctCount,
      total,
      details,
    });
  } catch (err) {
    console.error("❌ Lỗi submitQuiz:", err);
    res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi chấm điểm quiz.",
    });
  }
};
