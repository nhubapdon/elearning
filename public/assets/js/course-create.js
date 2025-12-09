const input = document.getElementById("thumbnailInput");
const previewImg = document.getElementById("thumbPreview");
const previewCardImg = document.getElementById("previewImg");

document.getElementById("dropzone").addEventListener("click", () => {
  input.click();
});

input.addEventListener("change", () => {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.style.display = "block";

    previewCardImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// Live update title + price
document.querySelector("input[name='title']").addEventListener("input", e => {
  document.getElementById("previewTitle").innerText = e.target.value || "Tên khóa học";
});

document.querySelector("input[name='price']").addEventListener("input", e => {
  const v = e.target.value;
  document.getElementById("previewPrice").innerText = v ? v.toLocaleString() + " VND" : "Miễn phí";
});
