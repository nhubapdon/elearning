document.addEventListener("DOMContentLoaded", () => {
  const avatars = document.querySelectorAll(".avatar-placeholder");

  avatars.forEach((el) => {
    const letters = el.dataset.letter || "?";

    // Danh sách màu nền có thể dùng
    const colors = [
      "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
      "#9D4EDD", "#00BFA6", "#FF9F1C", "#8338EC",
      "#EF476F", "#06D6A0", "#118AB2", "#073B4C"
    ];

    // Tạo màu ngẫu nhiên cho mỗi user
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.backgroundColor = color;
    el.textContent = letters;
  });

  // Hiệu ứng header cuộn
  const header = document.querySelector(".header");
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 50);
    });
  }
});
async function loadNotifications() {
  const res = await fetch("/notifications");
  const data = await res.json();

  const notifList = document.getElementById("notifList");
  const notifBadge = document.getElementById("notifBadge");

  notifList.innerHTML = "";

  let unread = 0;

  data.forEach(n => {
    if (!n.is_read) unread++;

    notifList.innerHTML += `
      <div class="notif-item" onclick="openNotification(${n.id}, ${n.course_id})">
        <div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-course">Khóa học: ${n.course_title}</div>
        </div>

        ${!n.is_read ? `<div class="notif-dot"></div>` : ""}
      </div>
    `;
  });

  if (unread > 0) {
    notifBadge.innerText = unread;
    notifBadge.style.display = "block";
  } else {
    notifBadge.style.display = "none";
  }
}

loadNotifications();

// TOGGLE DROPDOWN
document.getElementById("notifBell").addEventListener("click", () => {
  const menu = document.getElementById("notifDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// CLICK NOTIFICATION = MARK READ + REDIRECT
async function openNotification(id, courseId) {
  await fetch(`/notifications/${id}/read`, { method: "POST" });
  window.location.href = `/courses/${courseId}`;
}
