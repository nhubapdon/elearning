// routes/chat.js
import express from "express";
import { renderChatPage, startConversation, sendMessage, getUnreadCount, markAsRead } from "../controllers/chatController.js";

const router = express.Router();

router.get("/", renderChatPage);
router.post("/start", startConversation);
router.get("/unread-count", getUnreadCount);
router.post("/mark-read", markAsRead);
// Gửi tin nhắn
//router.post("/send", sendMessage);
export default router;
