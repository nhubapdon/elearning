// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/* ===========================================================
   🧠 1. Xác thực JWT cho API JSON
=========================================================== */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/* ===========================================================
   🧩 2. Middleware kiểm tra vai trò (dành cho API)
=========================================================== */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== role)
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  next();
};

/* ===========================================================
   🌐 3. Xác thực cho các trang EJS (dựa vào session)
=========================================================== */
export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    // Nếu chưa đăng nhập, chuyển về trang đăng nhập
    return res.redirect("/signin");
  }
  next();
};

/* ===========================================================
   👑 4. Chỉ dành cho giảng viên hoặc quản trị viên
=========================================================== */
export const requireInstructorOrAdmin = (req, res, next) => {
  const user = req.session.user;
  if (!user || (user.role !== "instructor" && user.role !== "admin")) {
    return res.status(403).render("errors/403", {
      title: "Truy cập bị từ chối",
      message: "Bạn không có quyền truy cập trang này.",
    });
  }
  next();
};
/* ===========================================================
   👑 5. kiểm tra coi admin only chưa
=========================================================== */
export const requireAdmin = (req, res, next) => {
  const user = req.session?.user;
  if (!user || user.role !== "admin") {
    return res.status(403).render("errors/403", {
      message: "Bạn không có quyền truy cập trang này."
    });
  }
  next();
};
export function ensureInstructorOrAdmin(req, res, next) {
  if (!req.user) return res.redirect("/signin");

  if (req.user.role === "admin") return next();
  if (req.user.role === "instructor") return next();

  return res.status(403).send("Bạn không có quyền truy cập.");
}
