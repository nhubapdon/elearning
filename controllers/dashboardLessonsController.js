import db from "../db.js";

// ===============================
// PAGE: danh sách khóa học để chọn
// ===============================
export async function selectCoursePage(req, res) {
  const user = req.user;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || "";
  const limit = 6;
  const offset = (page - 1) * limit;

  let coursesQuery = `
    SELECT * FROM courses
    WHERE title ILIKE $1
  `;
  let params = [`%${search}%`];

  // Nếu instructor thì chỉ lấy khóa của mình
  if (user.role === "instructor") {
    coursesQuery += ` AND instructor_id = $2`;
    params.push(user.id);
  }

  // Đếm tổng
  const countQuery = `SELECT COUNT(*) FROM (${coursesQuery}) AS t`;

  const total = (await db.query(countQuery, params)).rows[0].count;

  const courses = await db.query(
    `${coursesQuery} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  res.render("dashboard/lessons/courses", {
    user,
    courses: courses.rows,
    pagination: {
      page,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      search,
      from: offset + 1,
      to: offset + courses.rows.length,
    },
  });
}


// =================================
// PAGE: hiển thị bài học của 1 khóa
// =================================
export async function courseLessonsPage(req, res) {
  const { courseId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const offset = (page - 1) * limit;

  const course = await db.query(
    `SELECT * FROM courses WHERE id=$1`,
    [courseId]
  );

  const count = await db.query(
    `SELECT COUNT(*) FROM lessons WHERE course_id=$1`,
    [courseId]
  );

  const lessons = await db.query(
    `SELECT * FROM lessons 
     WHERE course_id=$1 
     ORDER BY order_index ASC
     LIMIT $2 OFFSET $3`,
    [courseId, limit, offset]
  );

  res.render("dashboard/lessons/index", {
    course: course.rows[0],
    lessons: lessons.rows,
    pagination: {
      page,
      totalPages: Math.ceil(count.rows[0].count / limit)
    }
  });
}
