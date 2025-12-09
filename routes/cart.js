import express from 'express';
import {
  viewCart,
  addToCart,
  removeFromCart,
  clearCart
} from '../controllers/cartController.js';

const router = express.Router();

// ✅ Không cần authenticate (vì EJS + session)
router.get('/', viewCart);
router.post('/add', addToCart);
router.post('/remove/:courseId', removeFromCart);
router.post('/clear', clearCart);

export default router;
