import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import pool from "../db.js";

// =============================================
// DASHBOARD CHÍNH (admin + instructor)
// =============================================
export const getDashboard = async (req, res) => {
  const user = req.user || req.session.user;

  if (!user) return res.redirect("/signin");

  // Student không có dashboard
  if (user.role === "student") {
    return res.redirect("/");
  }

  try {
    // =============================
    // ADMIN DASHBOARD
    // =============================
    if (user.role === "admin") {
      const [
        totalUsersResult,
        totalCoursesResult,
        totalEnrollmentsResult,
        totalRevenueResult,
        revenueByMonthResult,
        topCoursesResult,
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS total FROM users"),
        pool.query("SELECT COUNT(*) AS total FROM courses"),
        pool.query("SELECT COUNT(*) AS total FROM enrollments"),
        pool.query(`
          SELECT COALESCE(SUM(total_price),0) AS total 
          FROM orders 
          WHERE status='paid'
        `),
        pool.query(`
          SELECT 
            to_char(created_at,'YYYY-MM') AS month,
            COALESCE(SUM(total_price),0) AS revenue
          FROM orders
          WHERE status='paid'
          GROUP BY month
          ORDER BY month
        `),
        pool.query(`
          SELECT c.id, c.title, COUNT(e.*) AS enrollments
          FROM courses c
          LEFT JOIN enrollments e ON e.course_id = c.id
          GROUP BY c.id
          ORDER BY enrollments DESC
          LIMIT 5
        `),
      ]);

      return res.render("dashboard/index", {
        user,
        stats: {
          totalUsers: Number(totalUsersResult.rows[0].total),
          totalCourses: Number(totalCoursesResult.rows[0].total),
          totalEnrollments: Number(totalEnrollmentsResult.rows[0].total),
          totalRevenue: Number(totalRevenueResult.rows[0].total),
        },
        revenueByMonth: revenueByMonthResult.rows,
        topCourses: topCoursesResult.rows,
      });
    }

    // =============================
    // INSTRUCTOR DASHBOARD
    // =============================
    if (user.role === "instructor") {
      const instructorId = user.id;

      const [
        courseCountResult,
        studentCountResult,
        reviewCountResult,
        monthlyReviewResult,
        bestCoursesResult,
      ] = await Promise.all([
        // 1. Tổng số khóa dạy
        pool.query(`
          SELECT COUNT(*) AS total 
          FROM courses 
          WHERE instructor_id = $1
        `, [instructorId]),

        // 2. Tổng số học viên
        pool.query(`
          SELECT COUNT(*) AS total
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE c.instructor_id = $1
        `, [instructorId]),

        // 3. Tổng đánh giá
        pool.query(`
          SELECT COUNT(*) AS total
          FROM reviews r
          JOIN courses c ON c.id = r.course_id
          WHERE c.instructor_id = $1
        `, [instructorId]),

        // 4. Biểu đồ review theo tháng
        pool.query(`
          SELECT 
            to_char(r.created_at, 'YYYY-MM') AS month,
            COUNT(*) AS reviews
          FROM reviews r
          JOIN courses c ON c.id = r.course_id
          WHERE c.instructor_id = $1
          GROUP BY month
          ORDER BY month
        `, [instructorId]),

        // 5. Khóa học nhiều đánh giá nhất
        pool.query(`
          SELECT 
            c.id, 
            c.title,
            COUNT(r.*) AS review_count
          FROM courses c
          LEFT JOIN reviews r ON r.course_id = c.id
          WHERE c.instructor_id = $1
          GROUP BY c.id
          ORDER BY review_count DESC
          LIMIT 5
        `, [instructorId]),
      ]);

      return res.render("dashboard/instructor", {
        user,
        stats: {
          courseCount: Number(courseCountResult.rows[0].total),
          studentCount: Number(studentCountResult.rows[0].total),
          reviewCount: Number(reviewCountResult.rows[0].total),
        },
        revenueByMonth: monthlyReviewResult.rows.map(r => ({
          month: r.month,
          revenue: Number(r.reviews)
        })),
        topCourses: bestCoursesResult.rows.map(row => ({
          id: row.id,
          title: row.title,
          students: row.review_count
        })),
      });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).send("Lỗi tải dashboard");
  }
};


// =============================================
// 📦 DASHBOARD — QUẢN LÝ ORDERS (ADMIN)
// =============================================
export const getOrdersDashboard = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    // =============== ĐỌC THAM SỐ LỌC ===============
    const { status, method, from, to } = req.query;

    // Xây dựng điều kiện lọc (WHERE dynamic)
    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (status) {
      whereClauses.push(`o.status = $${idx++}`);
      params.push(status);
    }

    if (method) {
      whereClauses.push(`o.payment_method = $${idx++}`);
      params.push(method);
    }

    if (from) {
      whereClauses.push(`o.created_at >= $${idx++}`);
      params.push(from);
    }

    if (to) {
      whereClauses.push(`o.created_at <= $${idx++}`);
      params.push(to);
    }

    const whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // ===================== 1) STATS =====================
    const statsQuery = await pool.query(
      `
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_price),0) AS total_revenue,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS total_paid,
        SUM(CASE WHEN status!='paid' THEN 1 ELSE 0 END) AS total_pending
      FROM orders o
      ${whereSQL}
      `,
      params
    );

    const stats = {
      totalOrders: Number(statsQuery.rows[0].total_orders),
      totalRevenue: Number(statsQuery.rows[0].total_revenue),
      totalPaid: Number(statsQuery.rows[0].total_paid),
      totalPending: Number(statsQuery.rows[0].total_pending),
    };

    // ===================== 2) TOTAL COUNT FOR PAGINATION =====================
    const countQuery = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${whereSQL}`,
      params
    );
    const totalRows = Number(countQuery.rows[0].total);
    const totalPages = Math.max(Math.ceil(totalRows / limit), 1);

    // ===================== 3) FETCH ORDERS =====================
    const ordersQuery = await pool.query(
      `
      SELECT 
        o.*, 
        u.full_name,
        u.avatar,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS total_items
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereSQL}
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params
    );

    // ===================== 4) CHART — revenue =====================
    const revenueQuery = await pool.query(
      `
      SELECT 
        TO_CHAR(created_at,'YYYY-MM') AS month,
        SUM(total_price) AS revenue
      FROM orders o
      WHERE status='paid'
      GROUP BY 1
      ORDER BY 1
      `
    );

    // ===================== 5) CHART — order count =====================
    const ordersMonthQuery = await pool.query(
      `
      SELECT 
        TO_CHAR(created_at,'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM orders o
      GROUP BY 1
      ORDER BY 1
      `
    );

    return res.render("dashboard/orders", {
      stats,
      orders: ordersQuery.rows,
      revenueLabels: revenueQuery.rows.map(r => r.month),
      revenueValues: revenueQuery.rows.map(r => Number(r.revenue)),
      orderLabels: ordersMonthQuery.rows.map(r => r.month),
      orderCounts: ordersMonthQuery.rows.map(r => Number(r.count)),
      pagination: { currentPage: page, totalPages },
    });

  } catch (err) {
    console.error("Order dashboard filter error:", err);
    res.status(500).send("Lỗi lọc đơn hàng");
  }
};


export const exportOrdersPdf = async (req, res) => {
  try {
    const ordersQuery = await pool.query(`
      SELECT 
        o.*,
        u.full_name,
        (
          SELECT COUNT(*) 
          FROM order_items oi 
          WHERE oi.order_id = o.id
        ) AS total_items
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `);

    const orders = ordersQuery.rows;

    // ⭐ LOAD FONT UNICODE
    const fontNormal = path.join("public", "fonts", "Roboto_Condensed-Thin.ttf");
    const fontBold   = path.join("public", "fonts", "Roboto_Condensed-Bold.ttf");

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="orders.pdf"');

    doc.pipe(res);

    // DÙNG FONT CUSTOM
    doc.font(fontBold)
      .fontSize(20)
      .fillColor("#16a34a")
      .text("Danh sách đơn hàng", { align: "left" })
      .moveDown(0.3);

    doc.font(fontNormal)
      .fontSize(11)
      .fillColor("#64748b")
      .text("Báo cáo đơn hàng xuất từ hệ thống E-Learning", { align: "left" })
      .moveDown(1);

    const tableTop = 120;

    const col = {
      id: 40,
      user: 110,
      items: 260,
      total: 320,
      status: 400,
      method: 460,
      date: 520,
    };

    // Header background
    doc
      .roundedRect(30, tableTop - 12, 540, 24, 6)
      .fill("#ecfdf3");

    // HEADER TEXT
    doc.font(fontBold)
      .fontSize(10)
      .fillColor("#0f172a");

    doc.text("Mã", col.id, tableTop - 10);
    doc.text("Người mua", col.user, tableTop - 10);
    doc.text("SL", col.items, tableTop - 10);
    doc.text("Tổng tiền", col.total, tableTop - 10);
    doc.text("TT", col.status, tableTop - 10);
    doc.text("Thanh toán", col.method, tableTop - 10);
    doc.text("Ngày", col.date, tableTop - 10);

    let y = tableTop + 12;

    doc.font(fontNormal).fontSize(10);

    orders.forEach((o, index) => {
      if (y > 760) {
        doc.addPage();
        y = 60;
      }

      const isEven = index % 2 === 0;
      if (isEven) {
        doc.rect(30, y - 6, 540, 20)
          .fillOpacity(0.04)
          .fill("#22c55e")
          .fillOpacity(1);
      }

      const statusText = 
        o.status === "paid" ? "Paid" :
        o.status === "pending" ? "Pending" :
        "Failed";

      const statusColor = 
        o.status === "paid" ? "#16a34a" :
        o.status === "pending" ? "#ca8a04" :
        "#dc2626";

      // TEXT ROW
      doc.fillColor("#0f172a");
      doc.text(`#${o.id}`, col.id, y);
      doc.text(o.full_name, col.user, y, { width: 140 });
      doc.text(String(o.total_items), col.items, y);

      doc.text(
        `${Number(o.total_price).toLocaleString("vi-VN")} đ`,
        col.total,
        y,
        { width: 70 }
      );

      doc.fillColor(statusColor)
        .text(statusText, col.status, y);

      doc.fillColor("#0f172a")
        .text(o.payment_method, col.method, y);

      doc.text(
        new Date(o.created_at).toLocaleDateString("vi-VN"),
        col.date,
        y
      );

      y += 20;
    });

    doc.end();

  } catch (err) {
    console.error("Export orders PDF error:", err);
    res.status(500).send("Không thể xuất PDF");
  }
};
export const getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const orderQuery = await pool.query(`
      SELECT 
        o.*,
        u.full_name,
        u.email,
        u.avatar
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
    `, [id]);

    if (orderQuery.rows.length === 0) {
      return res.status(404).send("Không tìm thấy đơn hàng");
    }

    const order = orderQuery.rows[0];

    // Lấy danh sách khóa học trong đơn
    const itemsQuery = await pool.query(`
      SELECT 
        oi.*,
        c.title,
        c.thumbnail
      FROM order_items oi
      JOIN courses c ON c.id = oi.course_id
      WHERE oi.order_id = $1
    `, [id]);

    const items = itemsQuery.rows;

    res.render("dashboard/order-detail", {
      order,
      items
    });

  } catch (err) {
    console.error("Order detail error:", err);
    res.status(500).send("Lỗi tải chi tiết đơn hàng");
  }
};
