import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pool from "../db.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const avatar = profile.photos?.[0]?.value || null;

        if (!email) return done(new Error("Không lấy được email Google"), null);

        // kiểm tra user
        const check = await pool.query("SELECT * FROM users WHERE email = $1", [
          email,
        ]);

        let user;

        if (check.rows.length === 0) {
          const insert = await pool.query(
            `INSERT INTO users (full_name, email, password, role, avatar, provider)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, email, null, "student", avatar, "google"]
          );

          user = insert.rows[0];
        } else {
          user = check.rows[0];

          // nếu chưa có avatar thì cập nhật
          if (!user.avatar) {
            const update = await pool.query(
              `UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *`,
              [avatar, user.id]
            );

            user = update.rows[0];
          }
        }

        if (!user || !user.id) {
          return done(new Error("User không hợp lệ (không có id)"), null);
        }
        // ❗ Nếu tài khoản đã bị BAN thì không cho login bằng Google
        if (user.status === "banned") {
         return done(null, false, { message: "Tài khoản của bạn đã bị khóa bởi quản trị viên." });
        } 
        return done(null, user);
      } catch (err) {
        console.error("❌ Google Strategy Error:", err);
        return done(err, null);
      }
    }
  )
);

// serialize
passport.serializeUser((user, done) => {
  if (!user || !user.id) return done(new Error("User không có ID"), null);
  done(null, user.id);
});

// deserialize
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});
