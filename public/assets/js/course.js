// ============================================
// 📚 E-LEARNING: Courses Page Script
// 🔍 Lọc, Tìm kiếm & Hiệu ứng Ripple động
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const courseItems = document.querySelectorAll(".course-item");

  // 🔹 Hàm cập nhật danh sách khóa học theo điều kiện
  function updateCourses() {
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const activeCategory =
      document.querySelector(".filter-btn.active")?.dataset.category || "all";

    courseItems.forEach((item) => {
      const title = (item.dataset.title || "").toLowerCase();
      const category = item.dataset.category;

      const matchKeyword = title.includes(keyword);
      const matchCategory = activeCategory === "all" || category === activeCategory;

      item.style.display = matchKeyword && matchCategory ? "" : "none";
    });
  }

  // 🔍 Tìm kiếm theo tiêu đề
  if (searchInput) {
    searchInput.addEventListener("input", updateCourses);
  }

  // 🏷️ Lọc theo danh mục
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Xóa active cũ
      filterButtons.forEach((b) => b.classList.remove("active"));
      // Gắn active mới
      btn.classList.add("active");
      updateCourses();

      // 🪄 Hiệu ứng nhỏ khi đổi category
      courseItems.forEach((item) => {
        item.style.opacity = "0";
        setTimeout(() => {
          item.style.opacity = "1";
          item.style.transition = "opacity 0.4s ease";
        }, 100);
      });
    });
  });

  // Gọi lần đầu để đảm bảo khớp hiển thị ban đầu
  updateCourses();

  // 💧 Hiệu ứng Ripple động theo màu tag
  document.querySelectorAll(".ripple").forEach((el) => {
    el.addEventListener("click", (e) => {
      const ripple = document.createElement("span");
      ripple.className = "ripple-effect";

      // 🔹 Màu ripple dựa theo tone tag
      const tagColor = el.dataset.color;
      let color = "rgba(255,255,255,0.4)";
      if (tagColor === "blue") color = "rgba(37,99,235,0.4)";
      else if (tagColor === "orange") color = "rgba(251,146,60,0.4)";
      else if (tagColor === "purple") color = "rgba(168,85,247,0.4)";
      else if (tagColor === "teal") color = "rgba(13,148,136,0.4)";
      ripple.style.backgroundColor = color;

      // Xác định vị trí click
      const rect = el.getBoundingClientRect();
      ripple.style.left = e.clientX - rect.left + "px";
      ripple.style.top = e.clientY - rect.top + "px";

      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // =========================================================
  // 🛒 THÊM VÀO GIỎ HÀNG + TOAST THÔNG BÁO (AJAX)
  // =========================================================
  const toast = document.getElementById("cartToast");
  const toastMsg = document.getElementById("cartToastMessage");
  let toastTimer;

  function showCartToast(message) {
    if (!toast || !toastMsg) return;

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastMsg.textContent = message || "Đã thêm khóa học vào giỏ hàng";
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-add-cart");
    if (!btn) return;

    e.preventDefault();

    const courseId = btn.dataset.courseId;
    if (!courseId) return;

    try {
      const res = await fetch(`/courses/${courseId}/add-to-cart`, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json"
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          showCartToast("Vui lòng đăng nhập để thêm vào giỏ");
          return;
        }
        throw new Error("Request failed");
      }

      const data = await res.json().catch(() => ({}));
      showCartToast(data.message || "Đã thêm khóa học vào giỏ hàng");
    } catch (err) {
      console.error("Lỗi thêm vào giỏ:", err);
      showCartToast("Có lỗi xảy ra, vui lòng thử lại");
    }
  });
});
/* Cơ sở học tập trực tiếp */
document.addEventListener("DOMContentLoaded", () => {
  const counters = document.querySelectorAll(".lux-number");

  counters.forEach(counter => {
    const target = +counter.getAttribute("data-count");
    let current = 0;

    const interval = setInterval(() => {
      current++;
      counter.innerText = current + "+";

      if (current >= target) {
        clearInterval(interval);
      }
    }, 40);
  });
});