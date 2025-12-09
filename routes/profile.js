// routes/profile.js
import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  changePassword,
  updateAvatar,
} from "../controllers/profileController.js";

const router = express.Router();

// Middleware yêu cầu đăng nhập
function ensureAuth(req, res, next) {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.redirect("/signin");
  }
  req.user = user;
  next();
}

// Cấu hình multer để upload avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/avatars");
  },
  filename: (req, file, cb) => {
    const user = req.user || req.session.user;
    const ext = file.originalname.split(".").pop();
    cb(null, `avatar-${user.id}-${Date.now()}.${ext}`);
  },
});

const upload = multer({ storage });

// ====== ROUTES ======

// Trang hồ sơ
router.get("/", ensureAuth, getProfile);

// Cập nhật thông tin cơ bản
router.post("/update", ensureAuth, updateProfile);

// Đổi mật khẩu
router.post("/change-password", ensureAuth, changePassword);

// Upload avatar  (QUAN TRỌNG: POST /profile/avatar)
router.post("/avatar", ensureAuth, upload.single("avatar"), updateAvatar);

export default router;
