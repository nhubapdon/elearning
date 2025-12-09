import pool from "../db.js";

export const unreadCountMiddleware = async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.unreadCount = 0;
      return next();
    }

    const userId = req.session.user.id;

    const unreadRes = await pool.query(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN conversation_members cm
            ON cm.conversation_id = m.conversation_id
       WHERE cm.user_id = $1
         AND m.sender_id != $1
         AND m.seen = FALSE`,
      [userId]
    );

    res.locals.unreadCount = Number(unreadRes.rows[0].count);
    next();

  } catch (err) {
    console.error("Unread Count Middleware Error:", err);
    res.locals.unreadCount = 0;
    next();
  }
};
