// controllers/blogController.js
import pool from "../db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";


// Helper: tạo slug SEO-friendly từ title (không dùng thư viện ngoài)
function makeSlug(title) {
  return title
    .toLowerCase()
    .normalize("NFD") // bỏ dấu tiếng Việt
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper: parse danh sách tag id từ body (string hoặc array)
function parseTagIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => Number(v)).filter(Boolean);
  // string: "1,2,3"
  return String(raw)
    .split(",")
    .map((v) => Number(v.trim()))
    .filter(Boolean);
}

// =============== GET LIST (FILTER TAG + APPROVAL CHECK + PENDING COUNT) ===============
export const renderBlogList = async (req, res) => {
  try {
    const currentUser = req.session.user || null;
    const { tag } = req.query;

    // ===========================
    // ⭐ FILTER THEO TAG
    // ===========================
    let filterSQL = "";
    let params = [];

    if (tag) {
      filterSQL = `
        AND p.id IN (
          SELECT post_id
          FROM blog_post_tags bpt
          JOIN blog_tags bt ON bt.id = bpt.tag_id
          WHERE bt.slug = $1
        )
      `;
      params.push(tag);
    }

    // ===========================
    // ⭐ LẤY DANH SÁCH TẤT CẢ TAG
    // ===========================
    const tagQuery = await pool.query(`
      SELECT id, name, slug
      FROM blog_tags
      ORDER BY name ASC;
    `);
    const tagList = tagQuery.rows;

    // ===========================
    // ⭐ FILTER APPROVED / SELF POSTS
    // ===========================
    let approvalFilter = "";

    if (currentUser) {
      approvalFilter = `
        AND (
          p.is_approved = TRUE 
          OR p.user_id = ${currentUser.id}
        )
      `;
    } else {
      approvalFilter = `AND p.is_approved = TRUE`;
    }

    // ===========================
    // ⭐ SQL CHÍNH
    // ===========================
    const sql = `
      SELECT 
        p.id,
        p.title,
        p.slug,
        p.content,
        p.thumbnail,
        p.status,
        p.is_academic,
        p.is_approved,
        p.created_at,
        u.full_name AS author_name,
        u.avatar AS author_avatar,

        COALESCE(COUNT(DISTINCT bl.id), 0) AS like_count,
        COALESCE(COUNT(DISTINCT bc.id), 0) AS comment_count,

        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', bt.id,
              'name', bt.name,
              'slug', bt.slug
            )
          ) FILTER (WHERE bt.id IS NOT NULL),
          '[]'
        ) AS tags

      FROM blog_posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN blog_likes bl ON bl.post_id = p.id
      LEFT JOIN blog_comments bc ON bc.post_id = p.id
      LEFT JOIN blog_post_tags bpt ON bpt.post_id = p.id
      LEFT JOIN blog_tags bt ON bt.id = bpt.tag_id

      WHERE p.status = 'published'
      ${approvalFilter}     -- ⭐ QUAN TRỌNG
      ${filterSQL}

      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC;
    `;

    const result = await pool.query(sql, params);

    // ===========================
    // ⭐ CHECK USER ĐÃ LIKE CHƯA
    // ===========================
    if (currentUser) {
      for (let post of result.rows) {
        const check = await pool.query(
          `SELECT 1 FROM blog_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1`,
          [post.id, currentUser.id]
        );
        post.isLiked = check.rows.length > 0;
      }
    } else {
      for (let post of result.rows) post.isLiked = false;
    }

    // ===========================
    // ⭐ AJAX MODE
    // ===========================
    if (req.query.ajax === "1") {
      return res.render(
        "blog/partials/post_list",
        { posts: result.rows },
        (err, html) => {
          if (err) return res.status(500).send("Error loading");
          return res.send(html);
        }
      );
    }

    // ===========================
    // ⭐ COUNT PENDING POSTS (ADMIN)
    // ===========================
    let pendingCount = 0;

    if (currentUser && currentUser.role === "admin") {
      const pc = await pool.query(`
        SELECT COUNT(*) 
        FROM blog_posts 
        WHERE status = 'pending'
      `);

      pendingCount = Number(pc.rows[0].count);
    }

    // ===========================
    // ⭐ RENDER FULL PAGE
    // ===========================
    res.render("blog/index", {
      user: currentUser,
      posts: result.rows,
      tagList,
      activeTag: tag || null,
      pendingCount,   // ⭐⭐ TRUYỀN XUỐNG EJS
    });

  } catch (err) {
    console.error("renderBlogList error:", err);
    res.status(500).send("Server error");
  }
};




// =============== GET DETAIL (FULL + APPROVAL SYSTEM) ===============
export const renderBlogDetail = async (req, res) => {
  try {
    const currentUser = req.session.user || null;
    const { slug } = req.params;

    // ============================
    // ⭐ LẤY BÀI VIẾT
    // ============================
    const postRes = await pool.query(
      `
      SELECT 
        p.*,
        u.full_name AS author_name,
        u.avatar AS author_avatar,

        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', bt.id,
              'name', bt.name,
              'slug', bt.slug
            )
          ) FILTER (WHERE bt.id IS NOT NULL),
          '[]'
        ) AS tags,

        COALESCE(COUNT(DISTINCT bl.id), 0) AS like_count,
        COALESCE(COUNT(DISTINCT bc.id), 0) AS comment_count

      FROM blog_posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN blog_post_tags bpt ON bpt.post_id = p.id
      LEFT JOIN blog_tags bt ON bt.id = bpt.tag_id
      LEFT JOIN blog_likes bl ON bl.post_id = p.id
      LEFT JOIN blog_comments bc ON bc.post_id = p.id
      
      WHERE p.slug = $1
      GROUP BY p.id, u.id
      LIMIT 1;
      `,
      [slug]
    );

    if (!postRes.rows.length) {
      return res.status(404).send("Không tìm thấy bài viết");
    }

    const post = postRes.rows[0];

    // ============================
    // ⭐ KIỂM DUYỆT (is_approved)
    // ============================
    const isAdmin = currentUser?.role === "admin";
    const isOwner = currentUser && currentUser.id === post.user_id;

    if (!post.is_approved) {
      // 👉 Nếu admin → xem bình thường + xuất hiện nút duyệt
      if (isAdmin) {
        // cho phép xem
      }
      // 👉 Nếu là tác giả → xem bình thường
      else if (isOwner) {
        // cho phép xem
      }
      // 👉 Người khác → đưa sang trang pending.ejs
      else {
        return res.render("blog/pending", {
          user: currentUser,
          post,
        });
      }
    }

    // ============================
    // ⭐ LẤY COMMENT
    // ============================
    const commentsRes = await pool.query(
      `
      SELECT 
        c.*,
        u.full_name AS author_name,
        u.avatar AS author_avatar
      FROM blog_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC;
      `,
      [post.id]
    );
    const comments = commentsRes.rows;

    // ============================
    // ⭐ CHECK USER ĐÃ LIKE CHƯA
    // ============================
    let isLiked = false;
    if (currentUser) {
      const likeRes = await pool.query(
        `SELECT 1 FROM blog_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1;`,
        [post.id, currentUser.id]
      );
      isLiked = likeRes.rows.length > 0;
    }

    // ============================
    // ⭐ RENDER TRANG CHI TIẾT
    // ============================
    res.render("blog/detail", {
      user: currentUser,
      post,
      comments,
      isLiked,
      isAdmin,
      isOwner,
    });

  } catch (err) {
    console.error("renderBlogDetail error:", err);
    res.status(500).send("Server error");
  }
};


export const renderEditPost = async (req, res) => {
  try {
    const postId = req.params.postId;

    const postRes = await pool.query(`
      SELECT p.*, 
             json_agg(
               json_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
             ) FILTER (WHERE t.id IS NOT NULL) AS tags
      FROM blog_posts p
      LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
      LEFT JOIN blog_tags t ON t.id = pt.tag_id
      WHERE p.id = $1
      GROUP BY p.id;
    `, [postId]);

    const post = postRes.rows[0];

    // ⭐ QUAN TRỌNG — nếu không có tag => cho mảng rỗng
    post.tags = post.tags || [];

    // Lấy danh sách toàn bộ tags
    const tagListRes = await pool.query(`SELECT * FROM blog_tags ORDER BY name ASC`);
    const tagList = tagListRes.rows;

    res.render("blog/edit", {
      user: req.session.user,
      post,
      tagList,
    });

  } catch (err) {
    console.error("renderEditPost error:", err);
    res.redirect("/blog");
  }
};

// =============== POST CREATE ===============
export const createPost = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    }

    let { title, content, is_academic } = req.body;

    // ===============================================
    // ⭐ ĐĂNG NHANH → Tạo tiêu đề tự động
    // ===============================================
    if (!title || title.trim() === "") {
      if (!content || content.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Nội dung không được để trống.",
        });
      }

      title = content.split(" ").slice(0, 12).join(" ") + "...";
    }

    // ===============================================
    // ⭐ Kiểm tra nội dung trống
    // ===============================================
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung không được để trống.",
      });
    }

    // ===============================================
    // ⭐ Xử lý TAGS từ FormData
    // ===============================================
    let tagIds = parseTagIds(req.body.tags);

    // ⭐ Mặc định gắn tag học thuật nếu là bài học thuật
    const ACADEMIC_TAG_ID = 5; // CẬP NHẬT lại nếu trong DB khác

    if (is_academic === "1" || is_academic === true) {
      if (!tagIds.includes(ACADEMIC_TAG_ID)) {
        tagIds.push(ACADEMIC_TAG_ID);
      }
    }

    // ===============================================
    // ⭐ Tạo slug SEO
    // ===============================================
    let baseSlug = makeSlug(title);
    const slug = `${baseSlug}-${Date.now()}`;

    // ===============================================
    // ⭐ KIỂM DUYỆT NỘI DUNG (auto moderation)
    // ===============================================
    const badWords = [
  "tục", "dm", "địt", "cặc", "đụ", 
  "sex", "18+", 
  "khủng bố", "kill", 
  "tự tử", "suicide",
  "phản động", "chính trị",
  "xxx", "nude", "đm", "cái lồn", "clq", "clmm", "clmn"
];

    let isApproved = true;

    if (badWords.some((w) => content.toLowerCase().includes(w))) {
      isApproved = false; // bài cần duyệt
    }

    // ===============================================
    // ⭐ Thumbnail upload
    // ===============================================
let thumbnail = null;
if (req.file) {
  thumbnail = await uploadToCloudinary(req.file.path, "blog");
}

    // ===============================================
    // ⭐ INSERT BÀI VIẾT
    // ===============================================
    const insertPostRes = await pool.query(
      `
      INSERT INTO blog_posts 
        (user_id, title, slug, content, status, is_academic, thumbnail, is_approved)
      VALUES ($1, $2, $3, $4, 'published', $5, $6, $7)
      RETURNING *;
      `,
      [
        currentUser.id,
        title,
        slug,
        content,
        Boolean(is_academic),
        thumbnail,
        isApproved
      ]
    );

    const post = insertPostRes.rows[0];

    // ===============================================
    // ⭐ Lưu TAGS
    // ===============================================
    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        await pool.query(
          `INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2);`,
          [post.id, tagId]
        );
      }
    }

    // ===============================================
    // ⭐ Trả kết quả về FE
    // ===============================================
    return res.json({
      success: true,
      post,
      message: isApproved
        ? "Tạo bài viết thành công."
        : "Bài viết đang chờ quản trị viên duyệt do có nội dung nhạy cảm.",
    });

  } catch (err) {
    console.error("createPost error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// =============== POST COMMENT ===============
export const addComment = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    }

    const { postId } = req.params;
    const { content, parent_id } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Nội dung bình luận không được để trống." });
    }

    const insertRes = await pool.query(
      `
      INSERT INTO blog_comments (post_id, user_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
      `,
      [postId, currentUser.id, content.trim(), parent_id || null]
    );

    const comment = insertRes.rows[0];

    // Lấy thêm info user để trả về cho FE
    const detailRes = await pool.query(
      `
      SELECT 
        c.*,
        u.full_name AS author_name,
        u.avatar AS author_avatar
      FROM blog_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      LIMIT 1;
      `,
      [comment.id]
    );

    return res.json({
      success: true,
      comment: detailRes.rows[0],
    });
  } catch (err) {
    console.error("addComment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============== POST LIKE (TOGGLE) ===============
export const toggleLike = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    }

    const { postId } = req.params;

    const checkRes = await pool.query(
      `SELECT id FROM blog_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1;`,
      [postId, currentUser.id]
    );

    if (checkRes.rows.length > 0) {
      // Đã like -> bỏ like
      await pool.query(
        `DELETE FROM blog_likes WHERE post_id = $1 AND user_id = $2;`,
        [postId, currentUser.id]
      );
      return res.json({ success: true, liked: false });
    } else {
      // Chưa like -> like
      await pool.query(
        `INSERT INTO blog_likes (post_id, user_id) VALUES ($1, $2);`,
        [postId, currentUser.id]
      );
      return res.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error("toggleLike error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// =============== PUT EDIT ===============
export const updatePost = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser)
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });

    const { postId } = req.params;

    // An toàn tuyệt đối: tránh lỗi destructure undefined
    const title = req.body.title?.trim() || "";
    const content = req.body.content || "";
    const tagsRaw = req.body.tags || "";

    // Parse tags an toàn
    const tagIds = tagsRaw
      .toString()
      .split(",")
      .map(t => t.trim())
      .filter(t => t !== "" && !isNaN(t))
      .map(Number);

    // Check ownership
    const ownerRes = await pool.query(`SELECT * FROM blog_posts WHERE id = $1`, [postId]);
    if (!ownerRes.rows.length)
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });

    const post = ownerRes.rows[0];

    if (post.user_id !== currentUser.id)
      return res.status(403).json({ success: false, message: "Không có quyền chỉnh sửa." });

    // Giữ thumbnail cũ nếu user không upload ảnh mới
    let thumbnail = post.thumbnail;
    if (req.file) {
  thumbnail = await uploadToCloudinary(req.file.path, "blog");
}


    // UPDATE MAIN POST
    const updateRes = await pool.query(
      `
      UPDATE blog_posts
      SET title = $1,
          content = $2,
          thumbnail = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *;
      `,
      [title, content, thumbnail, postId]
    );

    // UPDATE TAGS
    await pool.query(`DELETE FROM blog_post_tags WHERE post_id = $1`, [postId]);

    for (const tag of tagIds) {
      await pool.query(
        `INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2)`,
        [postId, tag]
      );
    }

    return res.json({
      success: true,
      message: "Cập nhật bài viết thành công",
      post: updateRes.rows[0],
    });

  } catch (err) {
    console.error("updatePost", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật bài viết",
    });
  }
};

// =============== DELETE DELETE ===============
export const deletePost = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    }

    const { postId } = req.params;

    // Check quyền sở hữu
    const ownerRes = await pool.query(
      `SELECT user_id FROM blog_posts WHERE id = $1;`,
      [postId]
    );
    if (!ownerRes.rows.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết." });
    }
    if (ownerRes.rows[0].user_id !== currentUser.id) {
      return res.status(403).json({ success: false, message: "Không có quyền xoá." });
    }

    await pool.query(`DELETE FROM blog_posts WHERE id = $1;`, [postId]);

    return res.json({ success: true });
  } catch (err) {
    console.error("deletePost error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// =============== ADMIN DUYỆT BÀI ===============
export const approvePost = async (req, res) => {
  await pool.query(`
    UPDATE blog_posts SET is_approved = true WHERE id = $1
  `, [req.params.id]);

  res.json({ success: true });
};
// =============== ADMIN: DANH SÁCH BÀI CHỜ DUYỆT ===============
export const getPendingPosts = async (req, res) => {
  try {
    const pending = await pool.query(`
      SELECT 
        p.*,
        u.full_name AS author_name,
        u.avatar AS author_avatar
      FROM blog_posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_approved = false
      ORDER BY p.created_at DESC
    `);

    res.render("blog/admin_pending", {
      user: req.session.user,
      posts: pending.rows
    });

  } catch (err) {
    console.error("getPendingPosts error:", err);
    res.status(500).send("Server error");
  }
};
// =============== ADMIN REJECT POST ===============
export const rejectPost = async (req, res) => {
  try {
    const currentUser = req.session.user;

    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Không có quyền." });
    }

    const { id } = req.params;

    // Xóa khỏi DB
    await pool.query(`DELETE FROM blog_posts WHERE id = $1`, [id]);

    return res.json({ success: true, message: "Đã từ chối và xoá bài viết." });
  } catch (err) {
    console.error("rejectPost error:", err);
    return res.status(500).json({ success: false });
  }
};

