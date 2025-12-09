// routes/dashboard.js
import express from "express";
import { getDashboard, getOrdersDashboard, exportOrdersPdf, getOrderDetail  } from "../controllers/dashboardController.js";

const router = express.Router();

// Middleware chung: chỉ yêu cầu đăng nhập
function ensureLoggedIn(req, res, next) {
  const user = req.session?.user;

  if (!user) {
    return res.redirect("/signin");
  }

  req.user = user;
  next();
}

// GET /dashboard — tự phân quyền admin / instructor
router.get("/", ensureLoggedIn, getDashboard);
// Dashboard Orders
router.get("/orders", ensureLoggedIn, getOrdersDashboard);
router.get("/orders/export", ensureLoggedIn, exportOrdersPdf);
router.get("/orders/:id", ensureLoggedIn, getOrderDetail);
export default router;
