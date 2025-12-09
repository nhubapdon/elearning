// controllers/certificatesController.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import pool from "../db.js";

/**
 * Hàm kiểm tra điều kiện cấp chứng chỉ (bản sửa đúng cho CLICK-LESSON)
 *  - Đã enroll
 *  - Đã hoàn thành 100% số bài học (dựa vào is_completed)
 *  - Đã qua quiz >= 80 (giữ nguyên logic)
 */
// ⭐ CHỈ CẦN QUA QUIZ >= 80% LÀ ĐƯỢC NHẬN CHỨNG CHỈ
async function canIssueCertificate(userId, courseId) {
  // 1. Kiểm tra đã enroll (vẫn giữ lại)
  const enrollRes = await pool.query(
    `SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2`,
    [userId, courseId]
  );
  if (!enrollRes.rows.length)
    return { ok: false, reason: "Bạn chưa đăng ký khoá học này." };

  // 2. CHỈ KIỂM TRA QUIZ >= 80%
  const quizScoreRes = await pool.query(
    `
    SELECT qs.score
    FROM quiz_submissions qs
    JOIN quizzes q ON q.id = qs.quiz_id
    WHERE qs.user_id=$1 AND q.course_id=$2
    ORDER BY qs.submitted_at DESC
    LIMIT 1
    `,
    [userId, courseId]
  );

  const lastScore = quizScoreRes.rows.length
    ? Number(quizScoreRes.rows[0].score)
    : 0;

  if (lastScore < 80) {
    return {
      ok: false,
      reason: "Bạn cần đạt tối thiểu 80% điểm Quiz cuối khóa để nhận chứng chỉ.",
    };
  }

  return { ok: true };
}

/**
 * GET /courses/:courseId/certificate
 * -> Sinh file PDF + lưu DB + redirect về trang khoá học
 */
export const issueCertificate = async (req, res) => {
  try {
    const user = req.session.user;
    const { courseId } = req.params;

// 👉 Nếu file PDF cũ tồn tại → xoá để tạo file mới
const oldFileName = `certificate-u${user.id}-c${courseId}.pdf`;
const oldFilePath = path.join("public", "uploads", "certificates", oldFileName);

if (fs.existsSync(oldFilePath)) {
  console.log("⚠ File chứng chỉ cũ tồn tại → xoá trước khi tạo file mới");
  fs.unlinkSync(oldFilePath);
}
    if (!user) {
      return res.redirect("/signin");
    }

    // Kiểm tra đủ điều kiện
    const check = await canIssueCertificate(user.id, courseId);
    if (!check.ok) {
      req.flash("error_msg", check.reason);
      return res.redirect(`/courses/${courseId}`);
    }

// Lấy thông tin khoá học + tên giảng viên từ bảng users
const courseRes = await pool.query(
  `SELECT 
      c.title,
      u.full_name AS instructor_name
   FROM courses c
   LEFT JOIN users u ON u.id = c.instructor_id
   WHERE c.id = $1`,
  [courseId]
);

if (!courseRes.rows.length) {
  req.flash("error_msg", "Khoá học không tồn tại.");
  return res.redirect("/courses");
}

const course = courseRes.rows[0];


    // Tạo thư mục lưu chứng chỉ nếu chưa tồn tại
    const certDir = path.join("public", "uploads", "certificates");
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const fileName = `certificate-u${user.id}-c${courseId}.pdf`;
    const filePath = path.join(certDir, fileName);
    const publicUrl = `/uploads/certificates/${fileName}`;

    // URL verify (dùng trong QR)
    const verifyUrl = `${req.protocol}://${req.get(
      "host"
    )}/certificates/verify?user=${user.id}&course=${courseId}`;

    // Tạo QR code dạng base64
    const qrDataUrl = await QRCode.toDataURL(verifyUrl);

// ===== PDF CHUẨN =====
const doc = new PDFDocument({
  size: "A4",
  layout: "portrait",
  margin: 0
});
const writeStream = fs.createWriteStream(filePath);
doc.pipe(writeStream);

// ==== FONT ====
doc.registerFont("Normal", "public/fonts/LavishlyYours-Regular.ttf");
doc.registerFont("Bold", "public/fonts/Roboto_Condensed-Bold.ttf");

// ==== WATERMARK FULL, RÕ ====
try {
  doc.image("public/certificates/watermark.png", 0, 0, {
    width: doc.page.width,
    height: doc.page.height
  });
} catch {}

// ==== LOGO (góc phải trên, dịch sang phải) ====
try {
  doc.image("public/certificates/logo.png", 430, 40, { width: 140 });
} catch {}


// ===== TIÊU ĐỀ =====
doc.font("Bold")
  .fontSize(38)
  .fillColor("#222")
  .text("CERTIFICATE", 0, 160, { align: "center" });

doc.font("Bold")
  .fontSize(20)
  .fillColor("#444")
  .text("OF COMPLETION", 0, 205, { align: "center" });


// ===== DÒNG GIỚI THIỆU =====
doc.font("Normal")
  .fontSize(16)
  .fillColor("#555")
  .text("THIS CERTIFICATE IS PROUDLY PRESENTED TO:", 0, 250, {
    align: "center"
  });


// ===== TÊN HỌC VIÊN =====
doc.font("Normal")
  .fontSize(34)
  .fillColor("#008080")
  .text(user.full_name, 0, 295, {
    align: "center",
    underline: true
  });


// ===== NỘI DUNG =====
doc.font("Normal")
  .fontSize(16)
  .fillColor("#444")
  .text("has successfully completed the online course", 0, 350, { align: "center" });


// ===== TÊN KHÓA HỌC =====
doc.font("Bold")
  .fontSize(26)
  .fillColor("#222")
  .text(course.title, 0, 385, { align: "center" });


// ===============================
// 📌 KHU VỰC CHỮ KÝ – MỘC – NGÀY CẤP
// (đưa hết lên vùng trắng – đẹp & sang)
// ===============================

// ==== MỘC ĐỎ ====
try {
  doc.image("public/certificates/stamp.png", 210, 450, {
    width: 150
  });
} catch {}


// ==== CHỮ KÝ ====
try {
  doc.image("public/certificates/signature.png", 390, 435, {
    width: 160
  });
} catch {}

doc.font("Bold")
  .fontSize(14)
  .fillColor("#222")
  .text("Instructor", 400, 510);

doc.font("Normal")
  .fontSize(18)
  .text(course.instructor_name || "_________________", 360, 535);


// ==== NGÀY CẤP ====
const issuedDate = new Date().toLocaleDateString("vi-VN");

doc.font("Normal")
  .fontSize(14)
  .fillColor("#222")
  .text(`Issued on: ${issuedDate}`, 360, 565);


// ===== QR CODE (góc trái dưới) =====
try {
  const qrImg = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  doc.image(Buffer.from(qrImg, "base64"), 50, 600, { width: 130 });

  doc.fontSize(12)
    .fillColor("#444")
    .text("Scan to verify", 50, 740);

} catch {}


// END PDF
doc.end();





    // Khi ghi file xong mới lưu DB + redirect
    writeStream.on("finish", async () => {
      await pool.query(
        `
        INSERT INTO certificates (user_id, course_id, certificate_url)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id, course_id)
        DO UPDATE SET issued_at = NOW(), certificate_url = EXCLUDED.certificate_url
        `,
        [user.id, courseId, publicUrl]
      );

      req.flash("success_msg", "Đã tạo chứng chỉ, bạn có thể tải xuống.");
      return res.redirect(`/courses/${courseId}`);
    });

    writeStream.on("error", (err) => {
      console.error("❌ Lỗi ghi file PDF:", err);
      req.flash("error_msg", "Lỗi khi tạo chứng chỉ.");
      return res.redirect(`/courses/${courseId}`);
    });
  } catch (err) {
    console.error("❌ issueCertificate error:", err);
    req.flash("error_msg", "Lỗi server khi tạo chứng chỉ.");
    return res.redirect("back");
  }
};

/**
 * GET /certificates/verify?user=..&course=..
 * -> Trang verify (được nhúng trong QR code)
 */
export const verifyCertificate = async (req, res) => {
  try {
    const { user, course } = req.query;

    const certRes = await pool.query(
      `
      SELECT 
        c.*,
        u.full_name AS user_name,
        u.email,
        co.title AS course_title
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      JOIN courses co ON co.id = c.course_id
      WHERE c.user_id=$1 AND c.course_id=$2
      `,
      [user, course]
    );

    if (!certRes.rows.length) {
      return res.render("certificates/verify-notfound", {
        title: "Certificate verification",
        found: false,
      });
    }

    const cert = certRes.rows[0];

    return res.render("certificates/verify", {
      title: "Certificate verification",
      found: true,
      cert,
    });
  } catch (err) {
    console.error("❌ verifyCertificate error:", err);
    return res.status(500).send("Server error");
  }
};
