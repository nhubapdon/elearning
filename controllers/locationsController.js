import db from "../db.js";

// TRANG GIAO DIỆN MAP LUXURY
export const getLocationsPage = (req, res) => {
  res.render("locations/index", {
    title: "Hệ thống cơ sở đào tạo – E-Learning"
  });
};

// API LẤY ĐỊA ĐIỂM TỪ DATABASE THẬT
export const getLocationData = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, address, phone, lat, lng, opening_hours
      FROM locations
      ORDER BY id ASC;
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("Lỗi lấy data locations:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
};
