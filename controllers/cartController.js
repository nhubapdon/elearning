import db from '../db.js';

export const viewCart = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect('/signin');

  const { rows } = await db.query(
    `SELECT c.id, c.title, c.price, c.thumbnail
     FROM cart_items ci
     JOIN courses c ON ci.course_id = c.id
     WHERE ci.user_id = $1`,
    [userId]
  );

  res.render('cart/index', { items: rows });
};

export const addToCart = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect('/signin');

  const { course_id } = req.body;
  await db.query(
    `INSERT INTO cart_items (user_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, course_id]
  );

  res.redirect('/cart');
};

export const removeFromCart = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect('/signin');

  const { courseId } = req.params;
  await db.query(
    `DELETE FROM cart_items WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId]
  );

  res.redirect('/cart');
};

export const clearCart = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect('/signin');

  await db.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
  res.redirect('/cart');
};
