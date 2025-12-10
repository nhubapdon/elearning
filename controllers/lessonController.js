import db from "../db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import cloudinary from "../config/cloudinary.js";
// ================================
// GET: Tạo bài học (Hiển thị trang)
// ================================
export async function getCreateLessonPage(req, res) {
  const { courseId } = req.params;
  res.render("dashboard/lessons/create", { courseId });

}

// ================================
// POST: Tạo bài học
// ================================
export async function createLesson(req, res) {
  const { courseId } = req.params;
  const {
    title,
    content,
    video_url,
    level,
    duration,
    order_index,
    is_preview,
  } = req.body;

  try {
    let finalVideoUrl = video_url || null;

    // ========================================
    // 🔥 UPLOAD VIDEO MỚI LÊN CLOUDINARY
    // ========================================
    if (req.files.video && req.files.video.length > 0) {
      const videoFile = req.files.video[0];

      // Upload Cloudinary folder: lesson_videos
      const uploadedVideoUrl = await uploadToCloudinary(
        videoFile.path,
        "lesson_videos"
      );

      if (!uploadedVideoUrl) {
        return res.status(500).send("Không thể upload video bài học.");
      }

      finalVideoUrl = uploadedVideoUrl;
    }

    // ========================================
    // 🔥 LƯU BÀI HỌC VÀO DATABASE
    // ========================================
    const result = await db.query(
      `INSERT INTO lessons (
        course_id, title, content, video_url,
        level, duration, order_index, is_preview
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [
        courseId,
        title,
        content,
        finalVideoUrl,
        level || "beginner",
        duration || null,
        order_index || 0,
        is_preview ? true : false,
      ]
    );

    const lessonId = result.rows[0].id;

    // ========================================
    // 🔥 UPLOAD TÀI LIỆU BÀI HỌC (materials)
    // ========================================
    if (req.files.materials && req.files.materials.length > 0) {
      for (const f of req.files.materials) {
        const materialUrl = await uploadToCloudinary(
          f.path,
          "lesson_materials"
        );

        if (!materialUrl) {
          console.error("Material upload error:", f.originalname);
          continue; // Không crash khi 1 file lỗi
        }

        await db.query(
          `INSERT INTO lesson_materials 
            (lesson_id, file_name, file_path, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            lessonId,
            f.originalname,
            materialUrl,   // ← dùng URL Cloudinary
            f.size,
            f.mimetype,
          ]
        );
      }
    }

    // ========================================
    // 🔥 SUCCESS → REDIRECT
    // ========================================
    res.redirect(`/dashboard/lessons/courses/${courseId}/lessons`);

  } catch (err) {
    console.error("❌ createLesson error:", err);
    res.status(500).send("Error creating lesson");
  }
}

// ================================
// GET: Edit bài học
// ================================
export async function getEditLessonPage(req, res) {
  const { lessonId } = req.params;

  const lesson = await db.query(`SELECT * FROM lessons WHERE id=$1`, [lessonId]);
  const materials = await db.query(
    `SELECT * FROM lesson_materials WHERE lesson_id=$1`,
    [lessonId]
  );

  res.render("dashboard/lessons/edit", {
  lesson: lesson.rows[0],
  materials: materials.rows
});

}

// ================================
// POST: Update bài học
// ================================
export async function updateLesson(req, res) {
  const { lessonId } = req.params;
  const {
    title,
    content,
    video_url,
    level,
    duration,
    order_index,
    is_preview,
    delete_materials = [],
  } = req.body;

  try {
    // ================================
    // 🔥 Lấy dữ liệu cũ
    // ================================
    const old = await db.query(`SELECT * FROM lessons WHERE id=$1`, [lessonId]);
    if (!old.rows.length) return res.status(404).send("Lesson not found");

    const oldVideoUrl = old.rows[0].video_url;

    // ================================
    // 🔥 VIDEO: dùng video cũ mặc định
    // ================================
    let finalVideoUrl = video_url || oldVideoUrl;

    // ================================
    // 🔥 UPLOAD VIDEO MỚI LÊN CLOUDINARY
    // ================================
    if (req.files.video && req.files.video.length > 0) {
      const videoFile = req.files.video[0];

      // Upload video mới
      const uploadedVideo = await uploadToCloudinary(
        videoFile.path,
        "lesson_videos"
      );

      if (!uploadedVideo) {
        return res.status(500).send("Không thể upload video mới.");
      }

      finalVideoUrl = uploadedVideo;

      // Xóa video cũ trên Cloudinary (nếu có)
      if (oldVideoUrl && oldVideoUrl.startsWith("http")) {
        // format URL Cloudinary → lấy public_id
        const publicId = oldVideoUrl
          .split("/")
          .slice(-1)[0]
          .split(".")[0]; // lấy phần trước .mp4

        try {
          await cloudinary.uploader.destroy(`lesson_videos/${publicId}`, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Không xoá được video cũ Cloudinary:", err);
        }
      }
    }

    // ================================
    // 🔥 UPDATE LESSON TRONG DB
    // ================================
    await db.query(
      `UPDATE lessons SET
        title=$1, content=$2, video_url=$3,
        level=$4, duration=$5, order_index=$6, is_preview=$7
      WHERE id=$8`,
      [
        title,
        content,
        finalVideoUrl,
        level,
        duration,
        order_index,
        is_preview ? true : false,
        lessonId,
      ]
    );

    // ================================
    // 🔥 XOÁ TÀI LIỆU CŨ
    // ================================
    if (Array.isArray(delete_materials)) {
      for (const matId of delete_materials) {
        const mat = await db.query(
          `SELECT file_path FROM lesson_materials WHERE id=$1`,
          [matId]
        );

        if (mat.rows.length > 0) {
          const oldFileUrl = mat.rows[0].file_path;

          // Xóa trên Cloudinary nếu là URL
          if (oldFileUrl.startsWith("http")) {
            const publicId = oldFileUrl
              .split("/")
              .slice(-1)[0]
              .split(".")[0];

            try {
              await cloudinary.uploader.destroy(
                `lesson_materials/${publicId}`,
                { resource_type: "auto" }
              );
            } catch (err) {
              console.error("Không xoá được tài liệu cũ Cloudinary:", err);
            }
          }

          // Xóa DB
          await db.query(`DELETE FROM lesson_materials WHERE id=$1`, [matId]);
        }
      }
    }

    // ================================
    // 🔥 UPLOAD TÀI LIỆU MỚI
    // ================================
    if (req.files.materials && req.files.materials.length > 0) {
      for (const f of req.files.materials) {
        const materialUrl = await uploadToCloudinary(
          f.path,
          "lesson_materials"
        );

        if (!materialUrl) {
          console.error("Lỗi upload tài liệu:", f.originalname);
          continue;
        }

        await db.query(
          `INSERT INTO lesson_materials (lesson_id, file_name, file_path, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            lessonId,
            f.originalname,
            materialUrl,
            f.size,
            f.mimetype,
          ]
        );
      }
    }

    // ================================
    // 🔥 TRẢ VỀ
    // ================================
    res.redirect(`/lessons/${lessonId}/edit`);
  } catch (err) {
    console.error("updateLesson error:", err);
    res.status(500).send("Error updating lesson");
  }
}

// ================================
// DELETE MATERIAL
// ================================
export async function deleteMaterial(req, res) {
  const { id } = req.params;

  try {
    const file = await db.query(
      `SELECT file_path FROM lesson_materials WHERE id=$1`,
      [id]
    );

    if (file.rows.length > 0) {
      const fileUrl = file.rows[0].file_path;

      // Nếu là Cloudinary URL → xoá trên Cloudinary
      if (fileUrl.startsWith("http")) {
        try {
          // Lấy public_id từ URL
          const filename = fileUrl.split("/").pop();      // abc.pdf
          const publicId = filename.split(".")[0];        // abc

          await cloudinary.uploader.destroy(
            `lesson_materials/${publicId}`,
            { resource_type: "auto" }
          );
        } catch (err) {
          console.error("Không thể xoá file trên Cloudinary:", err);
        }
      }

      // Xóa khỏi DB
      await db.query(`DELETE FROM lesson_materials WHERE id=$1`, [id]);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("deleteMaterial error:", err);
    return res.status(500).json({ success: false });
  }
}
// ================================
// DELETE LESSON
// ================================
export async function deleteLesson(req, res) {
  const { lessonId } = req.params;

  try {
    // Lấy course_id để redirect
    const course = await db.query(
      "SELECT course_id, video_url FROM lessons WHERE id=$1",
      [lessonId]
    );

    const courseId = course.rows[0]?.course_id;
    const oldVideoUrl = course.rows[0]?.video_url;

    // =============================
    // 🔥 XÓA VIDEO CỦ (Cloudinary)
    // =============================
    if (oldVideoUrl && oldVideoUrl.startsWith("http")) {
      try {
        const filename = oldVideoUrl.split("/").pop();
        const publicId = filename.split(".")[0];

        await cloudinary.uploader.destroy(
          `lesson_videos/${publicId}`,
          { resource_type: "video" }
        );
      } catch (err) {
        console.error("Không thể xoá video Cloudinary:", err);
      }
    }

    // =============================
    // 🔥 XÓA TẤT CẢ TÀI LIỆU CỦ
    // =============================
    const mats = await db.query(
      "SELECT file_path FROM lesson_materials WHERE lesson_id=$1",
      [lessonId]
    );

    for (const m of mats.rows) {
      const url = m.file_path;

      if (url.startsWith("http")) {
        try {
          const filename = url.split("/").pop();
          const publicId = filename.split(".")[0];

          await cloudinary.uploader.destroy(
            `lesson_materials/${publicId}`,
            { resource_type: "auto" }
          );
        } catch (err) {
          console.error("Không thể xoá material Cloudinary:", err);
        }
      }
    }

    // Xóa DB materials
    await db.query("DELETE FROM lesson_materials WHERE lesson_id=$1", [lessonId]);

    // Xóa chính bài học
    await db.query("DELETE FROM lessons WHERE id=$1", [lessonId]);

    // Redirect
    return res.redirect(`/dashboard/lessons/courses/${courseId}/lessons`);

  } catch (err) {
    console.error("deleteLesson error:", err);
    return res.status(500).send("Error deleting lesson");
  }
}

export async function hardDeleteLesson(req, res) {
  const { lessonId } = req.params;

  await db.query(`DELETE FROM lesson_materials WHERE lesson_id=$1`, [lessonId]);
  await db.query(`DELETE FROM lessons WHERE id=$1`, [lessonId]);

  res.redirect("back");
}
