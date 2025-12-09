import pool from "../db.js";   // CHUẨN ESM

export const showMapPage = async (req, res) => {
  try {
    res.render("home/index", {
    // sau này nếu bạn muốn truyền location xuống trang home luôn
      locations: []   
    });
  } catch (err) {
    console.error("Lỗi khi load trang map:", err);
    res.status(500).send("Lỗi server khi load trang bản đồ");
  }
};

export const getLocations = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("Lỗi khi lấy danh sách địa điểm:", err);
    res.status(500).json({
      success: false,
      error: "Lỗi khi lấy danh sách địa điểm"
    });
  }
};
