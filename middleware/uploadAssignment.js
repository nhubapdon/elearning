// middleware/uploadAssignment.js
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/assignments"); // nhớ tạo thư mục này
  },
  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const assignmentUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB, tuỳ chỉnh
  },
});

export default assignmentUpload;
