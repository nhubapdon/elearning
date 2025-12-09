let editorInstance;

// CKEDITOR INIT
ClassicEditor.create(document.querySelector("#content"))
  .then(editor => { editorInstance = editor; })
  .catch(err => console.error(err));

// TAG SELECT
let selectedTags = [];

document.querySelectorAll(".tag-option").forEach(btn => {
  const id = Number(btn.dataset.id);

  if (btn.classList.contains("selected")) {
    selectedTags.push(id);
  }

  btn.addEventListener("click", () => {
    btn.classList.toggle("selected");

    if (selectedTags.includes(id)) {
      selectedTags = selectedTags.filter(t => t !== id);
    } else {
      selectedTags.push(id);
    }
  });
});

// SUBMIT EDIT
document.getElementById("editPostForm").addEventListener("submit", async e => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const content = editorInstance.getData();
  const thumb = document.getElementById("uploadThumbnail").files[0];

  const form = new FormData();
  form.append("title", title);
  form.append("content", content);
  form.append("tags", selectedTags.join(","));
  if (thumb) form.append("thumbnail", thumb);

  const postId = window.location.pathname.split("/").pop();

  const res = await fetch(`/blog/${postId}`, {
    method: "PUT",
    body: form,
  });

  const data = await res.json();

  if (data.success) {
    alert("Đã cập nhật bài viết!");
    window.location.href = `/blog/${data.post.slug}`;
  } else {
    alert(data.message || "Lỗi khi lưu bài viết!");
  }
});
