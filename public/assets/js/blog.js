document.addEventListener("DOMContentLoaded", function () {

/* ===========================
   AJAX FILTER TAG (NO RELOAD)
=========================== */

document.querySelectorAll(".blog-tag-link")?.forEach(tag => {
  tag.addEventListener("click", async function (e) {
    e.preventDefault();

    const slug = this.dataset.slug;
    const wrapper = document.querySelector(".blog-posts-wrapper");
    if (!wrapper) return;

    wrapper.style.opacity = "0";
    wrapper.style.transform = "translateY(10px)";
    wrapper.style.transition = "0.35s ease";

    const url = slug ? `/blog?tag=${slug}&ajax=1` : `/blog?ajax=1`;
    const res = await fetch(url);
    const html = await res.text();

    setTimeout(() => {
      wrapper.innerHTML = html;
      wrapper.style.opacity = "1";
      wrapper.style.transform = "translateY(0)";
    }, 350);
  });
});

/* ===========================
   LIKE / UNLIKE (AJAX)
=========================== */

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".like-btn");
  if (!btn) return;

  const postId = btn.dataset.postId || btn.dataset.id;
  const icon = btn.querySelector(".like-icon");
  const count = btn.querySelector(".like-count");

  const res = await fetch(`/blog/${postId}/like`, { method: "POST" });
  const data = await res.json();

  if (data.success) {
    if (data.liked) {
      icon.classList.remove("bi-heart");
      icon.classList.add("bi-heart-fill", "text-danger");
      count.textContent = Number(count.textContent) + 1;
    } else {
      icon.classList.remove("bi-heart-fill", "text-danger");
      icon.classList.add("bi-heart");
      count.textContent = Number(count.textContent) - 1;
    }
  }
});

/* ============ MODAL OPEN/CLOSE ============ */

const modal = document.getElementById("createPostModal");
const openBtn = document.getElementById("openCreateModalBtn");
const closeBtn = document.getElementById("closeModalBtn");

openBtn?.addEventListener("click", () => modal?.classList.remove("hidden"));
closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

/* ============ IMAGE PREVIEW ============ */
document.getElementById("uploadImage")?.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const preview = document.getElementById("imagePreview");
  preview.innerHTML = `<img src="${URL.createObjectURL(file)}">`;
  preview.classList.remove("hidden");
});

/* ============ TAG SELECT (MODAL) ============ */

let selectedTags = [];
document.querySelectorAll(".tag-select")?.forEach(tag => {
  tag.addEventListener("click", function () {
    const id = this.dataset.id;

    if (selectedTags.includes(id)) {
      selectedTags = selectedTags.filter(t => t !== id);
      this.classList.remove("selected");
    } else {
      selectedTags.push(id);
      this.classList.add("selected");
    }
  });
});

/* ============ SUBMIT POST (AJAX) ============ */

document.getElementById("submitPostBtn")?.addEventListener("click", async () => {
  const content = document.getElementById("postContent")?.value.trim();
  if (!content) return alert("Bạn chưa nhập nội dung!");

  const form = new FormData();
  form.append("content", content);

  selectedTags.forEach(t => form.append("tags[]", t));

  const image = document.getElementById("uploadImage")?.files[0];
  if (image) form.append("thumbnail", image);

  const res = await fetch("/blog/create", {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (data.success) {
    modal?.classList.add("hidden");
    location.reload();
  } else {
    alert("Lỗi tạo bài viết");
  }
});

/* ============ DROPDOWN ============ */

const ddBtn = document.getElementById("openCreateDropdown");
const ddMenu = document.getElementById("createDropdownMenu");

ddBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  ddMenu?.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".create-dropdown-wrapper")) {
    ddMenu?.classList.add("hidden");
  }
});

/* ============ OPEN QUICK POST ============ */
document.getElementById("openQuickPost")?.addEventListener("click", () => {
  ddMenu?.classList.add("hidden");
  modal?.classList.remove("hidden");
});

/* ============ GOTO ACADEMIC CREATE PAGE ============ */
document.getElementById("openAcademicPost")?.addEventListener("click", () => {
  ddMenu?.classList.add("hidden");
  window.location.href = "/blog/create?academic=1";
});

/* ===========================
       COMMENT AJAX
=========================== */

document.addEventListener("submit", async (e) => {
  const form = e.target.closest(".comment-form");
  if (!form) return;

  e.preventDefault();

  const postId = form.action.split("/blog/")[1].split("/")[0];
  const textarea = form.querySelector("textarea[name='content']");
  const content = textarea.value.trim();
  if (!content) return;

  const res = await fetch(`/blog/${postId}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  const data = await res.json();
  if (!data.success) return;

  const c = data.comment;

  const html = `
    <div class="comment-item">
      <img src="${c.author_avatar}" class="comment-avatar" />
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${c.author_name}</span>
          <span class="comment-time">${new Date(c.created_at).toLocaleString("vi-VN")}</span>
        </div>
        <div class="comment-content">${c.content}</div>
      </div>
    </div>
  `;

  document.querySelector(".comment-list")?.insertAdjacentHTML("afterbegin", html);
  textarea.value = "";
});

});
/* ===========================
       XOÁ BÀI VIẾT (có confirm)
=========================== */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-post");
  if (!btn) return;

  const id = btn.dataset.id;

  if (!confirm("Bạn có chắc chắn muốn xoá bài viết này vĩnh viễn?")) return;

  const res = await fetch(`/blog/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (data.success) {
    alert("Đã xoá bài viết!");
    location.reload();
  } else {
    alert("Không thể xoá bài viết.");
  }
});
/* ===========================
       ẨN BÀI VIẾT (FE-only)
=========================== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".hide-post");
  if (!btn) return;

  const post = btn.closest(".post-item");
  post.style.display = "none";
});
/* ===========================
       CHỈNH SỬA
=========================== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".edit-post");
  if (!btn) return;

  const id = btn.dataset.id;
  window.location.href = `/blog/edit/${id}`;
});
/* ===========================
   MENU 3 CHẤM (POST ACTIONS)
=========================== */

document.addEventListener("click", (e) => {
  // 1. Đóng tất cả menu nếu click ra ngoài
  if (!e.target.closest(".post-actions-wrapper")) {
    document
      .querySelectorAll(".post-actions-menu.show")
      .forEach(m => m.classList.remove("show"));
  }

  // 2. Mở / đóng menu khi bấm nút 3 chấm
  const toggleBtn = e.target.closest(".post-actions-toggle");
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();

    const wrapper = toggleBtn.closest(".post-actions-wrapper");
    const menu = wrapper.querySelector(".post-actions-menu");

    // Đóng các menu khác
    document
      .querySelectorAll(".post-actions-menu.show")
      .forEach(m => {
        if (m !== menu) m.classList.remove("show");
      });

    menu.classList.toggle("show");
  }

  // 3. Ẩn bài viết (FE)
  const hideBtn = e.target.closest(".post-action-hide");
  if (hideBtn) {
    const cardCol = hideBtn.closest(".col-xl-4, .col-lg-4, .col-md-6");
    if (cardCol) cardCol.style.display = "none";
  }

  // 4. Xoá bài viết (DELETE tới BE)
  const deleteBtn = e.target.closest(".post-action-delete");
  if (deleteBtn) {
    const postId = deleteBtn.dataset.postId;
    if (!postId) return;

    if (!confirm("Bạn có chắc chắn muốn xoá bài viết này? Hành động này không thể hoàn tác.")) {
      return;
    }

    fetch(`/blog/${postId}`, { method: "DELETE" })
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (data.success) {
          const cardCol = deleteBtn.closest(".col-xl-4, .col-lg-4, .col-md-6");
          if (cardCol) cardCol.remove();
        } else {
          alert(data.message || "Xoá bài viết thất bại.");
        }
      })
      .catch(() => alert("Có lỗi xảy ra khi xoá bài viết."));
  }

  // 5. Chỉnh sửa (tạm thời: điều hướng sang trang detail/slug hoặc tương lai là trang edit)
  const editBtn = e.target.closest(".post-action-edit");
  if (editBtn) {
    const postId = editBtn.dataset.postId;
    // TODO: nếu sau này có /blog/:id/edit thì redirect vào đó
    // hiện giờ có thể cho tạm redirect vào trang chi tiết:
    const cardAnchor = editBtn.closest(".card").closest("a");
    if (cardAnchor && cardAnchor.href) {
      window.location.href = cardAnchor.href;
    }
  }
});
/* ==========================
      EDIT BUTTON (DETAIL)
========================== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".action-edit-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  window.location.href = `/blog/edit/${id}`;
});

/* ==========================
      DELETE BUTTON (DETAIL)
========================== */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".action-delete-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  if (!confirm("Bạn chắc chắn muốn xóa bài viết này?")) return;

  const res = await fetch(`/blog/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (data.success) {
    alert("Đã xóa bài viết!");
    window.location.href = "/blog";
  } else {
    alert(data.message || "Không thể xóa bài viết.");
  }
});



// ======================= HIDE POST =======================
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".hide-post-btn");
  if (!btn) return;

  alert("Bài viết đã được ẩn khỏi trang cá nhân của bạn.");

  // không cần gọi API — ẩn bằng CSS ngay lập tức
  document.querySelector(".blog-detail-page").style.display = "none";
});
