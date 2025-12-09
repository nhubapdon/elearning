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
