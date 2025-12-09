// controllers/chatController.js
import pool from "../db.js";

// ==============================
// 1. RENDER TRANG CHAT
// ==============================
export const renderChatPage = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) return res.redirect("/signin");

    const userId = currentUser.id;
    const activeConvoId = req.query.conversationId
      ? Number(req.query.conversationId)
      : null;

    // 📨 LẤY DANH SÁCH CUỘC TRÒ CHUYỆN CỦA USER
    const convoRes = await pool.query(
      `
      SELECT
        c.id,
        c.is_group,
        c.title,
        u_other.id   AS other_user_id,
        u_other.full_name AS other_user_name,
        u_other.avatar    AS other_user_avatar,
        m_last.content AS last_message,
        m_last.created_at AS last_time
      FROM conversations c
      JOIN conversation_members cm_self
        ON cm_self.conversation_id = c.id
       AND cm_self.user_id = $1
      LEFT JOIN conversation_members cm_other
        ON cm_other.conversation_id = c.id
       AND cm_other.user_id <> $1
      LEFT JOIN users u_other
        ON u_other.id = cm_other.user_id
      LEFT JOIN LATERAL (
        SELECT content, created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m_last ON TRUE
      ORDER BY m_last.created_at DESC NULLS LAST, c.created_at DESC
      `,
      [userId]
    );

    const conversations = convoRes.rows;

    // 👥 DANH SÁCH TẤT CẢ USER KHÁC (cho cột "Người dùng")
    const allUsersRes = await pool.query(
      `
      SELECT id, full_name, avatar
      FROM users
      WHERE id <> $1
      ORDER BY full_name ASC
      `,
      [userId]
    );
    const allUsers = allUsersRes.rows;

    // 💬 LẤY TIN NHẮN CỦA CUỘC TRÒ CHUYỆN ĐANG ACTIVE
    let messages = [];
    let activeConvo = null;

    if (activeConvoId) {
      // Check user này có thuộc cuộc trò chuyện ko
      const isMemberRes = await pool.query(
        `
        SELECT 1
        FROM conversation_members
        WHERE conversation_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [activeConvoId, userId]
      );

      if (isMemberRes.rows.length > 0) {
        const active = conversations.find((c) => c.id === activeConvoId);
        if (active) {
          activeConvo = active;
        } else {
          // trường hợp convo không có trong list trên (hiếm)
          const singleRes = await pool.query(
            `
            SELECT
              c.id,
              c.is_group,
              c.title,
              u_other.id   AS other_user_id,
              u_other.full_name AS other_user_name,
              u_other.avatar    AS other_user_avatar
            FROM conversations c
            JOIN conversation_members cm_self
              ON cm_self.conversation_id = c.id
             AND cm_self.user_id = $1
            LEFT JOIN conversation_members cm_other
              ON cm_other.conversation_id = c.id
             AND cm_other.user_id <> $1
            LEFT JOIN users u_other
              ON u_other.id = cm_other.user_id
            WHERE c.id = $2
            `,
            [userId, activeConvoId]
          );
          activeConvo = singleRes.rows[0] || null;
        }

        // Lấy messages
        const msgRes = await pool.query(
          `
          SELECT 
            m.id,
            m.sender_id,
            m.content,
            m.created_at,
            to_char(m.created_at, 'HH24:MI DD/MM') AS created_at_relative
          FROM messages m
          WHERE m.conversation_id = $1
          ORDER BY m.created_at ASC
          `,
          [activeConvoId]
        );
        messages = msgRes.rows;
                // Đánh dấu tất cả tin nhắn của đối phương trong cuộc trò chuyện này là đã đọc
        await pool.query(
          `
          UPDATE messages
          SET seen = TRUE
          WHERE conversation_id = $1
            AND sender_id <> $2
          `,
          [activeConvoId, userId]
        );

      }
    }

    res.render("chat/index", {
      user: currentUser,
      conversations,
      allUsers,
      activeConvoId,
      activeConvo,
      messages,
    });
  } catch (err) {
    console.error("❌ renderChatPage error:", err);
    res.status(500).send("Server error");
  }
};

// ==============================
// 2. BẮT ĐẦU / LẤY CONVERSATION 1-1
// ==============================
export const startConversation = async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) return res.redirect("/login");

    const userId = currentUser.id;
    const otherUserId = Number(req.body.otherUserId);

    if (!otherUserId || otherUserId === userId) {
      return res.redirect("/chat");
    }

    // Tìm conversation 1-1 đã tồn tại
    const existRes = await pool.query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_members cm1 ON cm1.conversation_id = c.id
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id
      WHERE c.is_group = FALSE
        AND cm1.user_id = $1
        AND cm2.user_id = $2
      LIMIT 1
      `,
      [userId, otherUserId]
    );

    let conversationId;

    if (existRes.rows.length > 0) {
      conversationId = existRes.rows[0].id;
    } else {
      // Tạo conversation mới
      const createConvo = await pool.query(
        `
        INSERT INTO conversations (is_group, title)
        VALUES (FALSE, NULL)
        RETURNING id
        `
      );
      conversationId = createConvo.rows[0].id;

      // Thêm 2 thành viên
      await pool.query(
        `
        INSERT INTO conversation_members (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
        `,
        [conversationId, userId, otherUserId]
      );
    }

    // Form đang submit trực tiếp -> redirect
    return res.redirect(`/chat?conversationId=${conversationId}`);
  } catch (err) {
    console.error("❌ startConversation error:", err);
    res.status(500).send("Server error");
  }
};

// ==============================
// 3. (OPTIONAL) HTTP GỬI TIN NHẮN – HIỆN KHÔNG DÙNG
// ==============================
// Vì ta đã cho SOCKET.IO lo chuyện lưu DB khi gửi tin,
// route này có thể không dùng tới. Giữ lại để sau nếu muốn dùng AJAX.
export const sendMessage = async (req, res) => {
  try {
    return res.status(501).json({
      success: false,
      message: "Đang dùng Socket.IO để gửi tin nhắn, không dùng HTTP /chat/send.",
    });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ⭐ GET UNREAD MESSAGE COUNT
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT COUNT(*) AS unread
      FROM messages m
      JOIN conversation_members cm
        ON cm.conversation_id = m.conversation_id
      WHERE cm.user_id = $1
        AND m.sender_id != $1
        AND m.seen = FALSE
      `,
      [userId]
    );

    res.json({ unread: Number(result.rows[0].unread) });
  } catch (err) {
    console.error("Unread count error:", err);
    res.json({ unread: 0 });
  }
};
// ⭐ MARK CONVERSATION AS READ
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    await pool.query(
      `
      UPDATE messages
      SET seen = TRUE
      WHERE conversation_id = $1
        AND sender_id != $2
      `,
      [conversationId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.json({ success: false });
  }
};
