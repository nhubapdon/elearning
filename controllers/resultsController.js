// backend/controllers/resultsController.js
import pool from '../db.js';

export const getResultsForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM quiz_results WHERE user_id=$1 ORDER BY taken_at DESC', [userId]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
};

export const getResultsForQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const result = await pool.query('SELECT qr.*, u.full_name FROM quiz_results qr JOIN users u ON qr.user_id=u.id WHERE qr.quiz_id=$1 ORDER BY qr.taken_at DESC', [quizId]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
};
