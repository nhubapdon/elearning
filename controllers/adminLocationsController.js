import db from "../db.js";

// LIST
// GET /admin/locations
export async function listLocations(req, res) {
  const { search = "", category = "", province = "", page = 1 } = req.query;

  const limit = 10;
  const offset = (page - 1) * limit;

  // WHERE conditions
  let conditions = ["is_deleted = FALSE"];
  let params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(address) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  if (category) {
    conditions.push(`category = $${idx}`);
    params.push(category);
    idx++;
  }

  if (province) {
    conditions.push(`province_code = $${idx}`);
    params.push(province);
    idx++;
  }

  const whereSQL = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // COUNT TOTAL
  const countQuery = `SELECT COUNT(*) AS total FROM locations ${whereSQL}`;
  const countResult = await db.query(countQuery, params);
  const totalItems = parseInt(countResult.rows[0].total, 10);

  // PAGINATED DATA
  const dataQuery = `
      SELECT *
      FROM locations
      ${whereSQL}
      ORDER BY id DESC
      LIMIT ${limit}
      OFFSET ${offset}
  `;
  const dataResult = await db.query(dataQuery, params);

  // Provinces (dropdown)
  const provincesResult = await db.query("SELECT * FROM provinces ORDER BY name ASC");

  // PAGINATION OBJECT
  const totalPages = Math.ceil(totalItems / limit);

  const pagination = {
    page: Number(page),
    limit,
    totalItems,
    totalPages,
    from: offset + 1,
    to: offset + dataResult.rows.length
  };

  res.render("admin/locations/index", {
    locations: dataResult.rows,
    provinces: provincesResult.rows,
    filters: { search, category, province },
    pagination
  });
}




// SHOW CREATE FORM
export const showCreateForm = (req, res) => {
  res.render("admin/locations/create", {
    title: "Thêm cơ sở mới"
  });
};

export const createLocation = async (req, res) => {
  try {
    const { name, category, address, phone, lat, lng, opening_hours } = req.body;

    await db.query(
      `INSERT INTO locations (name, category, address, phone, lat, lng, opening_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [name, category, address, phone, lat, lng, opening_hours]
    );

    req.flash("success_msg", "Đã thêm cơ sở mới thành công!");
    res.redirect("/admin/locations");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Lỗi khi thêm cơ sở.");
    res.redirect("/admin/locations/create");
  }
};


// SHOW EDIT FORM
export async function showEditForm(req, res) {
  const id = req.params.id;

  const locResult = await db.query("SELECT * FROM locations WHERE id = $1", [id]);

  if (locResult.rows.length === 0) {
    return res.redirect("/admin/locations");
  }

  const provincesResult = await db.query("SELECT code, name FROM provinces ORDER BY name ASC");

  res.render("admin/locations/edit", {
    location: locResult.rows[0],
    provinces: provincesResult.rows
  });
}


// UPDATE
export async function updateLocation(req, res) {
  const id = req.params.id;
  const { name, address, phone, opening_hours, lat, lng, category, province_code } = req.body;

  await db.query(
    `UPDATE locations 
     SET name=$1, address=$2, phone=$3, opening_hours=$4,
         lat=$5, lng=$6, category=$7, province_code=$8
     WHERE id=$9`,
    [name, address, phone, opening_hours || null, lat, lng, category, province_code, id]
  );

  req.flash("success_msg", "Cập nhật cơ sở thành công!");
  res.redirect("/admin/locations");
}


// DELETE (SOFT DELETE)
export async function deleteLocation(req, res) {
  const id = req.params.id;

  await db.query("UPDATE locations SET is_deleted = TRUE WHERE id = $1", [id]);
  req.flash("success_msg", "Đã xoá cơ sở thành công!");
  res.redirect("/admin/locations");
}


// API
export async function apiLocations(req, res) {
  const { province, category, search } = req.query;

  const result = await db.query(
    `SELECT *
     FROM locations
     WHERE is_deleted = FALSE
     AND ($1 = '' OR province_code = $1)
     AND ($2 = '' OR category = $2)
     AND ($3 = '' OR name ILIKE $3 OR address ILIKE $3)
     ORDER BY id DESC`,
    [
      province || "",
      category || "",
      search ? `%${search}%` : ""
    ]
  );

  res.json(result.rows);
}
// ⭐ LẤY DANH SÁCH ĐÃ XÓA (Recycle Bin)
export async function showTrashLocations(req, res) {
  const result = await db.query(
    "SELECT * FROM locations WHERE is_deleted = true ORDER BY id DESC"
  );

  res.render("admin/locations/trash", {
    deletedLocations: result.rows   // ✅ ĐÚNG
  });

}

// ⭐ KHÔI PHỤC CƠ SỞ
export async function restoreLocation(req, res) {
  const id = req.params.id;

  await db.query(
    "UPDATE locations SET is_deleted = FALSE WHERE id = $1",
    [id]
  );

  res.redirect("/admin/locations/trash");
}

// ⭐ XÓA VĨNH VIỄN
// HARD DELETE (Xóa vĩnh viễn khỏi DB)
export async function hardDeleteLocation(req, res) {
  try {
    const id = req.params.id;

    await db.query("DELETE FROM locations WHERE id = $1", [id]);

    res.redirect("/admin/locations/trash");
  } catch (err) {
    console.error("Hard Delete Error:", err);
    res.status(500).send("Lỗi khi xóa vĩnh viễn");
  }
}


