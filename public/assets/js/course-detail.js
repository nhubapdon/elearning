// public/assets/js/course-detail.js
(() => {
  const playerBox = document.getElementById("playerBox");
  let player = document.getElementById("lessonPlayer");

  const lessonItems = document.querySelectorAll(".lesson-item");
  const courseId = window.courseId; // ĐÃ được gán trong detail.ejs

  /* ===================================================
     🎥 1. Chuyển bài học + đánh dấu hoàn thành
  =================================================== */
  lessonItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (item.classList.contains("locked")) return;

      // Đặt active
      lessonItems.forEach((it) => it.classList.remove("active"));
      item.classList.add("active");

      const src = item.dataset.src || "";
      const lessonId = item.dataset.id;

      // Đổi video
      if (src.includes("youtube.com") || src.includes("youtu.be")) {
        const videoID = extractYoutubeId(src);
        playerBox.innerHTML = `
          <iframe id="lessonPlayer"
                  width="100%" height="500"
                  src="https://www.youtube.com/embed/${videoID}"
                  frameborder="0" allowfullscreen></iframe>`;
      } else {
        playerBox.innerHTML = `
          <video id="lessonPlayer"
                 controls playsinline
                 src="${src}"></video>`;
      }

      player = document.getElementById("lessonPlayer");

      // Gửi completed = true (click bài = đã học xong)
      if (!lessonId || !courseId) return;

      fetch(`/courses/${courseId}/lesson/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSecond: 0,
          completed: true,
        }),
      }).catch((err) =>
        console.error("❌ Lỗi đánh dấu completed:", err)
      );
    });
  });

  function extractYoutubeId(url) {
    const patterns = [/v=([^&]+)/, /youtu\.be\/([^?]+)/, /embed\/([^?]+)/];
    for (let p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return "";
  }

  /* ===================================================
     ⭐ 2. Star input (đánh giá khóa học)
  =================================================== */
  const starInput = document.querySelector(".star-input");
  if (starInput) {
    const input = starInput.querySelector('input[name="rating"]');
    const paint = (v) => {
      starInput.querySelectorAll("i").forEach((el, idx) => {
        el.classList.toggle("bi-star-fill", idx < v);
        el.classList.toggle("bi-star", idx >= v);
      });
    };
    starInput.querySelectorAll("i").forEach((i) => {
      i.addEventListener("mouseenter", () => paint(i.dataset.value));
      i.addEventListener("click", () => {
        input.value = i.dataset.value;
        paint(i.dataset.value);
      });
    });
    paint(input.value || 5);
  }

  /* ===================================================
     🌟 3. Stars fill hiển thị trung bình rating
  =================================================== */
  document.querySelectorAll(".stars-fill").forEach((el) => {
    const width = parseFloat(el.dataset.width || 0);
    el.style.width = width + "%";
    el.style.transition = "width 0.8s ease";
  });

  /* ===================================================
     📊 4. Thanh tiến trình khóa học
  =================================================== */
  document.querySelectorAll(".progress-bar").forEach((el) => {
    const pct = parseFloat(el.dataset.progress || 0);
    el.style.width = pct + "%";
    el.style.transition = "width 1s ease";
    el.style.background = "linear-gradient(90deg, #00bfff, #4facfe)";
  });

  /* ===================================================
     🛒 5. Thêm vào giỏ + toast (AJAX)
  =================================================== */
  const toast = document.getElementById("cartToast");
  const toastMsg = document.getElementById("cartToastMessage");
  let toastTimer;

  function showCartToast(message) {
    if (!toast || !toastMsg) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message || "Đã thêm khóa học vào giỏ";
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-add-cart");
    if (!btn) return;

    e.preventDefault();

    try {
      const res = await fetch(`/courses/${courseId}/add-to-cart`, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
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
})();


