/* ============================
   PREVIEW THUMBNAIL
============================ */
document.getElementById("thumbInput")?.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const previewBox = document.getElementById("thumbPreview");
  const previewImg = document.getElementById("thumbPreviewImg");

  previewImg.src = URL.createObjectURL(file);
  previewBox.classList.remove("hidden");
});

/* ============================
   CKEDITOR – Word-like Editor
============================ */
let editorInstance;

ClassicEditor.create(document.querySelector('#editor'), {
  toolbar: {
    items: [
      'heading',
      '|',
      'bold', 'italic', 'underline', 'strikethrough',
      '|',
      'bulletedList', 'numberedList',
      '|',
      'link', 'blockQuote', 'insertTable',
      '|',
      'undo', 'redo'
    ]
  },
  table: {
    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
  }
})
.then(editor => {
  editorInstance = editor;
})
.catch(error => console.error("CKEditor error:", error));

/* ============================
   SUBMIT ACADEMIC POST (FIX)
============================ */
document.getElementById("academicPostForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("titleInput").value.trim();
  const content = editorInstance.getData();
  const thumb = document.getElementById("thumbInput").files[0];

  const selectedTags = document.getElementById("selectedTagsInput").value;  
  // dạng: "3,5,7"

  if (!title) return alert("Vui lòng nhập tiêu đề!");
  if (!content) return alert("Vui lòng nhập nội dung!");

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("is_academic", true);

  // ⭐ Gửi danh sách tags
  formData.append("tags", selectedTags);

  if (thumb) formData.append("thumbnail", thumb);

  const res = await fetch("/blog/create", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert("Đăng bài thành công!");
    window.location.href = "/blog";
  } else {
    alert(data.message || "Lỗi đăng bài!");
  }
});

/* ============ TAG SELECT ============ */
let selectedTags = [];

document.querySelectorAll(".tag-option")?.forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.id;

    if (selectedTags.includes(id)) {
      selectedTags = selectedTags.filter(t => t !== id);
      btn.classList.remove("selected");
    } else {
      selectedTags.push(id);
      btn.classList.add("selected");
    }

    // ghi vào hidden input
    document.getElementById("selectedTagsInput").value = selectedTags.join(",");
  });
});
