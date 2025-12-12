// middleware/uploadAssignment.js
import multer from "multer";

/**
 * ✅ Railway/Hosting: KHÔNG nên dùng diskStorage (ghi file local)
 * ✅ Dùng memoryStorage để controller upload lên Cloudinary (req.file.buffer)
 */
const storage = multer.memoryStorage();

// (Tuỳ chọn) lọc định dạng file được phép nộp
const fileFilter = (req, file, cb) => {
  // Cho phép các loại file phổ biến
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream", // một số trình duyệt upload zip/rar có thể ra dạng này
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  if (allowed.includes(file.mimetype)) return cb(null, true);

  // Nếu bạn muốn "cho tất cả" thì đổi thành cb(null, true)
  return cb(new Error("Định dạng file không được hỗ trợ."), false);
};

const assignmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export default assignmentUpload;
