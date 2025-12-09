// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import { fileURLToPath } from "url";
import flash from "connect-flash";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { unreadCountMiddleware } from "./middleware/unreadCount.js";




import pool from "./db.js";
import "./auth/googleStrategy.js";
import homeRoutes from "./routes/home.js";
import authRoutes from "./routes/auth.js";
import mapRoutes from "./routes/map.js";
import blogRoutes from "./routes/blog.js";
import locationsRoutes from "./routes/locations.js";
import usersRoutes from "./routes/users.js";
import coursesRoutes from "./routes/courses.js";
import lessonRoutes from "./routes/lessons.js";
import quizRoutes from "./routes/quizzes.js";
import quizzesRouter from "./routes/quizzes.js";
import resultsRoutes from "./routes/results.js";
import cartRoutes from "./routes/cart.js";
import checkoutRoutes from "./routes/checkout.js";
import myCoursesRoutes from "./routes/myCourses.js";
import dashboardRoutes from './routes/dashboard.js';
import adminUsersRoutes from "./routes/adminUsers.js";
import mapTestRoutes from "./routes/mapTest.js";
import profileRoutes from "./routes/profile.js";
import adminLocationsRoutes from "./routes/adminLocations.js";
import instructorRoutes from "./routes/instructor.js";
import dashboardLessonsRoutes from "./routes/dashboardLessons.js";
import adminQuizzesRoutes from "./routes/admin/quizzes.js";
import adminInstructorsRoutes from "./routes/admin/dashboardInstructors.js";
import chatRoutes from "./routes/chat.js";
import certificatesRoutes from "./routes/certificates.js";  // thêm dòng này
import assignmentsRoutes from "./routes/assignments.js";
import dashboardAssignmentsRoutes from "./routes/dashboardAssignments.js";

dotenv.config();

// ==========================
// 🔧 CẤU HÌNH CƠ BẢN
// ==========================
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = process.env.PORT || 5000;

// Tạo __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 🖥️ THIẾT LẬP EJS VIEW ENGINE
// ==========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
// Serve toàn bộ uploads trong public
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Serve thư mục lesson materials
app.use("/uploads/lesson_materials", express.static("public/uploads/lesson_materials"));
app.use("/uploads/videos", express.static("public/uploads/videos"));
app.use("/uploads/thumbnails", express.static("public/uploads/thumbnails"));

// ==========================
// 🧩 MIDDLEWARE
// ==========================
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: true }));
// Cho phép EJS dùng biến req trong tất cả view
app.use((req, res, next) => {
  res.locals.req = req; // ✨ để trong EJS có thể dùng req.originalUrl
  next();
});


// ==========================
// 🧠 SESSION & PASSPORT SETUP
// ==========================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
// Cho phép EJS truy cập user ở mọi trang
app.use((req, res, next) => {
  req.user = req.session.user || null; 
  res.locals.user = req.session.user || null;
  next();
});
app.use(async (req, res, next) => {
  try {
    if (req.session?.user) {
      const userId = req.session.user.id;

      const cartRes = await pool.query(
        "SELECT COUNT(*) AS total FROM cart_items WHERE user_id = $1",
        [userId]
      );

      req.session.cartCount = Number(cartRes.rows[0].total);
    } else {
      req.session.cartCount = 0;
    }

    res.locals.cartCount = req.session.cartCount;
    next();

  } catch (err) {
    console.error("❌ CartCount middleware error:", err);
    res.locals.cartCount = 0;
    next();
  }
});

app.use(flash());
// Middleware chạy cho toàn bộ trang
app.use(unreadCountMiddleware);

// ==========================
// 🎯 GOOGLE STRATEGY
// ==========================

// ==========================
// 🚀 ROUTES – ORDER MATTERS
// ==========================

// 1️⃣ API routes (Luôn đặt ĐẦU TIÊN)
app.use("/api/users", usersRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/results", resultsRoutes);

// 2️⃣ Business routes có prefix riêng
app.use("/courses", coursesRoutes);           // ⭐ MUST COME BEFORE /lessons
app.use("/lessons", lessonRoutes);            // lesson CRUD
app.use("/my-courses", myCoursesRoutes);
app.use("/assignments", assignmentsRoutes);

app.use("/map", mapRoutes);
app.use("/test-map", mapTestRoutes);
app.use("/locations", locationsRoutes);

app.use("/blog", blogRoutes);

// 3️⃣ Quiz routes (CHỈ mount 1 lần duy nhất)
app.use("/quizzes", quizRoutes);              // ⛔ XÓA cái này nếu trùng
app.use("/quizzes", quizzesRouter);        

// 4️⃣ Commerce routes
app.use("/cart", cartRoutes);
app.use("/checkout", checkoutRoutes);

// 5️⃣ User / Instructor routes
app.use("/profile", profileRoutes);
app.use("/instructor", instructorRoutes);
app.use("/chat", chatRoutes);    

// 6️⃣ Dashboard (admin/staff)
app.use("/dashboard", dashboardRoutes);
app.use("/dashboard/lessons", dashboardLessonsRoutes);
app.use("/dashboard/users", adminUsersRoutes);
app.use("/dashboard/assignments", dashboardAssignmentsRoutes);
// 7️⃣ Admin modules
app.use("/admin/locations", adminLocationsRoutes);
app.use("/admin/quizzes", adminQuizzesRoutes);
app.use("/admin/instructors", adminInstructorsRoutes);

// 8️⃣ Certificates (có dùng /courses nhưng KHÔNG conflict)
app.use("/", certificatesRoutes);

// 9️⃣ Auth routes (login, register)
app.use("/", authRoutes);

// 🔟 Cuối cùng phải là trang chủ (home)
app.use("/", homeRoutes);


// ==========================
// 🧱 DATABASE CONNECTION TEST
// ==========================
pool
  .connect()
  .then((client) => {
    client.release();
    console.log("✅ Connected to PostgreSQL");
  })
  .catch((err) => console.error("❌ DB connection error", err.stack));
  // ✅ Kiểm tra cột trong bảng lessons để xác nhận schema
const checkColumn = async () => {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'lessons';
    `);
    console.log("🧱 Cột trong bảng lessons:", result.rows.map(r => r.column_name));
  } catch (err) {
    console.error("❌ Lỗi khi kiểm tra bảng lessons:", err);
  }
};
checkColumn();
// ==========================
// 🔌 SOCKET.IO CHAT
// ==========================
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // Join room theo conversationId
  socket.on("joinConversation", (conversationId) => {
    const room = `conversation_${conversationId}`;
    socket.join(room);
  });

  // Nhận tin nhắn mới từ client
  socket.on("sendMessage", async (payload) => {
    try {
      const { conversationId, senderId, content } = payload;
      if (!content || !String(content).trim()) return;

      // Lưu vào DB
      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, sender_id, content, created_at`,
        [conversationId, senderId, content.trim()]
      );

      const message = result.rows[0];

      // Broadcast tới tất cả client trong room
      io.to(`conversation_${conversationId}`).emit("newMessage", {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        content: message.content,
        created_at: message.created_at,
      });
    } catch (err) {
      console.error("❌ Socket sendMessage error:", err);
    }
  });
});


// ==========================
// ⚠️ ERROR HANDLER
// ==========================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ==========================
// 🚀 START SERVER
// ==========================
server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

