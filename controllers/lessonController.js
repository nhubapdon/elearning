import db from "../db.js";
import fs from "fs";

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

    // Nếu upload video file
    if (req.files.video && req.files.video.length > 0) {
      const video = req.files.video[0];
      finalVideoUrl = `/uploads/videos/${video.filename}`;
    }

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

    // Tải tài liệu
    if (req.files.materials) {
      for (const f of req.files.materials) {
        await db.query(
          `INSERT INTO lesson_materials (lesson_id, file_name, file_path, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            lessonId,
            f.originalname,
            `/uploads/lesson_materials/${f.filename}`,
            f.size,
            f.mimetype,
          ]
        );
      }
    }

    res.redirect(`/dashboard/lessons/courses/${courseId}/lessons`);

  } catch (err) {
    console.error("createLesson error:", err);
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
    const old = await db.query(`SELECT * FROM lessons WHERE id=$1`, [lessonId]);
    const oldVideo = old.rows[0].video_url;

    let finalVideoUrl = video_url || oldVideo;

    // Upload video mới
    if (req.files.video && req.files.video.length > 0) {
      const video = req.files.video[0];
      finalVideoUrl = `/uploads/videos/${video.filename}`;

      // Xóa video cũ
      if (oldVideo && oldVideo.startsWith("/uploads")) {
        try { fs.unlinkSync(`public${oldVideo}`); } catch {}
      }
    }

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

    // Xóa tài liệu cũ
    if (Array.isArray(delete_materials)) {
      for (const id of delete_materials) {
        const mat = await db.query(
          `SELECT file_path FROM lesson_materials WHERE id=$1`,
          [id]
        );

        if (mat.rows.length > 0) {
          const path = mat.rows[0].file_path;
          try { fs.unlinkSync(`public${path}`); } catch {}

          await db.query(`DELETE FROM lesson_materials WHERE id=$1`, [id]);
        }
      }
    }

    // Upload tài liệu mới
    if (req.files.materials) {
      for (const f of req.files.materials) {
        await db.query(
          `INSERT INTO lesson_materials (lesson_id, file_name, file_path, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            lessonId,
            f.originalname,
            `/uploads/lesson_materials/${f.filename}`,
            f.size,
            f.mimetype,
          ]
        );
      }
    }

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

  const file = await db.query(
    `SELECT file_path FROM lesson_materials WHERE id=$1`,
    [id]
  );

  if (file.rows.length > 0) {
    try { fs.unlinkSync(`public${file.rows[0].file_path}`); } catch {}
    await db.query(`DELETE FROM lesson_materials WHERE id=$1`, [id]);
  }

  res.json({ success: true });
}
// ================================
// DELETE LESSON
// ================================
export async function deleteLesson(req, res) {
  const { lessonId } = req.params;

  try {
    // Lấy course_id để redirect về danh sách bài học
    const course = await db.query(
      "SELECT course_id FROM lessons WHERE id=$1",
      [lessonId]
    );

    const courseId = course.rows[0]?.course_id;

    // Xóa tất cả tài liệu thuộc bài học
    const mats = await db.query(
      "SELECT file_path FROM lesson_materials WHERE lesson_id=$1",
      [lessonId]
    );

    for (const m of mats.rows) {
      try { fs.unlinkSync(`public${m.file_path}`); } catch {}
    }

    await db.query("DELETE FROM lesson_materials WHERE lesson_id=$1", [lessonId]);

    // Xóa bài học
    await db.query("DELETE FROM lessons WHERE id=$1", [lessonId]);

    // Điều hướng về danh sách bài học
    res.redirect(`/dashboard/lessons/courses/${courseId}/lessons`);
  } catch (err) {
    console.error("deleteLesson error:", err);
    res.status(500).send("Error deleting lesson");
  }
}
export async function hardDeleteLesson(req, res) {
  const { lessonId } = req.params;

  await db.query(`DELETE FROM lesson_materials WHERE lesson_id=$1`, [lessonId]);
  await db.query(`DELETE FROM lessons WHERE id=$1`, [lessonId]);

  res.redirect("back");
}
