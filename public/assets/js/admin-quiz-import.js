// public/assets/js/admin-quiz-import.js

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("importExcelInput");
  const previewContent = document.getElementById("importPreviewContent");
  const finalImportFile = document.getElementById("finalImportFile");

  if (!fileInput) return;

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Copy file vào input thật để Submit khi Xác nhận
    finalImportFile.files = fileInput.files;

    // Đọc Excel bằng FileReader
    const reader = new FileReader();
    reader.onload = function (evt) {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

      previewContent.innerHTML = "";

      rows.forEach((row, index) => {
        const block = document.createElement("div");
        block.className = "mb-3 border-bottom pb-2";

        block.innerHTML = `
          <h6 class="fw-bold">Câu hỏi #${index + 1}</h6>
          <p><b>Quiz:</b> ${row.title}</p>
          <p><b>Khóa học:</b> ${row.course_title || row.course_id}</p>
          <p><b>Câu hỏi:</b> ${row.question}</p>
          <p><b>Đáp án:</b></p>
          <ul>
            ${row.option_1 ? `<li>${row.option_1}</li>` : ""}
            ${row.option_2 ? `<li>${row.option_2}</li>` : ""}
            ${row.option_3 ? `<li>${row.option_3}</li>` : ""}
            ${row.option_4 ? `<li>${row.option_4}</li>` : ""}
          </ul>
          <p><b>Đáp án đúng:</b> ${row.correct_index}</p>
        `;

        previewContent.appendChild(block);
      });

      // Mở Modal
      const modal = new bootstrap.Modal(document.getElementById("importPreviewModal"));
      modal.show();
    };

    reader.readAsBinaryString(file);
  });
});
