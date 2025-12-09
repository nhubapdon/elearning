// public/assets/js/chat.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const conversationId = window.conversationId;
  const currentUserId = window.currentUserId;
  const otherAvatar = window.otherAvatar || "";

  const messagesBox = document.getElementById("messagesBox");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");

  // Join room nếu đang ở trong 1 cuộc trò chuyện
  if (conversationId) {
    socket.emit("joinConversation", conversationId);
  }

  function scrollToBottom() {
    if (!messagesBox) return;
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function appendMessage(msg) {
    if (!messagesBox) return;

    const senderId = msg.senderId ?? msg.sender_id; // phòng trường hợp server đặt tên khác
    const isMe = Number(senderId) === Number(currentUserId);

    const row = document.createElement("div");
    row.classList.add("msg-row", isMe ? "me" : "other");

    let avatarHtml = "";
    if (!isMe && otherAvatar) {
      avatarHtml = `<img src="${otherAvatar}" class="msg-avatar" alt="avatar">`;
    }

    row.innerHTML = `
      ${!isMe && otherAvatar ? avatarHtml : ""}
      <div class="bubble-wrapper">
        <div class="bubble">${msg.content}</div>
      </div>
    `;

    messagesBox.appendChild(row);
    scrollToBottom();
  }

  // Lúc mới load trang, kéo xuống cuối
  scrollToBottom();

  function handleSend(e) {
    if (e) e.preventDefault();
    if (!input || !conversationId) return;

    const text = input.value.trim();
    if (!text) return;

    // Gửi qua socket (server lưu DB + broadcast)
    socket.emit("sendMessage", {
      conversationId,
      senderId: currentUserId,
      content: text,
    });

    // Xoá input
    input.value = "";
  }

  if (form) {
    form.addEventListener("submit", handleSend);
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", handleSend);
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        handleSend(e);
      }
    });
  }

  // Nhận tin nhắn realtime
  socket.on("newMessage", (msg) => {
    if (!conversationId) return;
    if (String(msg.conversationId) !== String(conversationId)) return;
    appendMessage(msg);
  });
});
