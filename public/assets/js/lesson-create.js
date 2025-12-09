// -------------------------
// YOUTUBE PREVIEW
// -------------------------
const videoUrlInput = document.getElementById("videoUrl");
const ytPreviewBox = document.getElementById("ytPreviewBox");
const existingVideoUrl = document.getElementById("existingVideoUrl");

function extractYouTubeId(url) {
  if (!url) return null;

  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

  const match = url.match(regex);
  return match ? match[1] : null;
}

function renderYouTubePreview() {
  const url = videoUrlInput.value.trim();
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    ytPreviewBox.innerHTML = `
      <div class="text-muted">Chưa có video. Nhập link YouTube hoặc upload file video.</div>
    `;
    return;
  }

  ytPreviewBox.innerHTML = `
    <iframe width="100%" height="315"
      style="border-radius: 14px;"
      src="https://www.youtube.com/embed/${videoId}" 
      frameborder="0"
      allowfullscreen>
    </iframe>
    <div class="text-center mt-2 text-muted">Nguồn: YouTube</div>
  `;
}

if (videoUrlInput) {
  videoUrlInput.addEventListener("input", renderYouTubePreview);
  if (existingVideoUrl && existingVideoUrl.value.trim() !== "") {
    videoUrlInput.value = existingVideoUrl.value;
    renderYouTubePreview();
  }
}

// -------------------------
// FILE MATERIALS DROPZONE (FIX CHUẨN 100%)
// -------------------------
const materialsDropZone = document.getElementById("materialsDropZone");
const materialsInput = document.getElementById("materialsInput");
const materialList = document.getElementById("materialList");

function updateInputFiles(files) {
  const dataTransfer = new DataTransfer();

  for (let file of files) {
    dataTransfer.items.add(file);
  }

  materialsInput.files = dataTransfer.files;
  renderMaterialList();
}

// Kéo thả
materialsDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  materialsDropZone.classList.remove("drag-over");

  // Chrome CHỈ chấp nhận input.files = dataTransfer.files
  updateInputFiles(e.dataTransfer.files);
});

// Browse file
materialsInput.addEventListener("change", () => {
  updateInputFiles(materialsInput.files);
});

// Click mở file
materialsDropZone.addEventListener("click", () => materialsInput.click());

// Drag UI
materialsDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  materialsDropZone.classList.add("drag-over");
});

materialsDropZone.addEventListener("dragleave", () => {
  materialsDropZone.classList.remove("drag-over");
});

// Preview danh sách
function renderMaterialList() {
  materialList.innerHTML = "";

  if (!materialsInput.files.length) {
    materialList.innerHTML = `<div class="text-muted small">Không có tài liệu nào.</div>`;
    return;
  }

  Array.from(materialsInput.files).forEach((file) => {
    const item = document.createElement("div");
    item.className = "material-item";
    item.innerHTML = `
      <i class="bi bi-file-earmark"></i>
      ${file.name} - ${(file.size / 1024).toFixed(1)} KB
    `;
    materialList.appendChild(item);
  });
}


// -------------------------
// VIDEO FILE PREVIEW (OPTIONAL)
// -------------------------
const videoFileInput = document.querySelector("input[name='video']");

if (videoFileInput) {
  videoFileInput.addEventListener("change", () => {
    const file = videoFileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Vui lòng chọn file video hợp lệ.");
      return;
    }

    ytPreviewBox.innerHTML = `
      <video width="100%" controls style="border-radius: 14px;">
        <source src="${URL.createObjectURL(file)}" type="${file.type}">
      </video>
      <div class="text-center mt-2 text-muted">Nguồn: Video upload</div>
    `;
  });
}

// -------------------------
// END
// -------------------------
console.log("lesson-create.js loaded successfully");
