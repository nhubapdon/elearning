document.addEventListener("DOMContentLoaded", () => {
  const rawData = window.__QUIZ_DETAIL_DATA__ || [];
  const resultMap = {};

  rawData.forEach((r) => {
    resultMap[r.id] = r;
  });

  const modalEl = document.getElementById("attemptDetailModal");
  if (!modalEl) return;

  const modal = new bootstrap.Modal(modalEl);
  const bodyEl = document.getElementById("attemptDetailBody");

  function renderAttemptDetail(item) {
    if (!item || !Array.isArray(item.details)) {
      bodyEl.innerHTML =
        "<p class='text-muted mb-0'>Không có dữ liệu chi tiết.</p>";
      return;
    }

    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div class="fw-semibold mb-1">
            <i class="bi bi-person-fill me-1"></i>${item.user}
          </div>
          <div class="text-muted small">
            <i class="bi bi-clock-history me-1"></i>
            Điểm: <b>${item.score}%</b> • 
            Đúng: <b>${item.correctCount}/${item.totalQuestions}</b> câu
          </div>
        </div>
      </div>
    `;

    item.details.forEach((q, index) => {
      const options = q.options || [];

      html += `
        <div class="attempt-question-block mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="fw-semibold">
              Câu ${index + 1}: ${q.question || "(Không có nội dung câu hỏi)"}
            </div>
            <div>
              ${
                q.isCorrect
                  ? '<span class="badge bg-success-soft text-success"><i class="bi bi-check2-circle me-1"></i>Đúng</span>'
                  : '<span class="badge bg-danger-soft text-danger"><i class="bi bi-x-circle me-1"></i>Sai</span>'
              }
            </div>
          </div>
          <ul class="mb-0 ps-3">
      `;

    options.forEach((opt, optIdx) => {
  const isCorrect = optIdx === q.correctIndex;
  const isUser = optIdx === q.userIndex;

  let cls = "";
  if (isCorrect) cls += " text-success fw-semibold";
  if (isUser && !isCorrect) cls += " text-danger fw-semibold";

  html += `
    <li class="${cls}">
      ${opt}
      ${isCorrect ? '<span class="badge bg-success-soft text-success ms-1">Đáp án đúng</span>' : ''}
      ${isUser ? '<span class="badge bg-info-soft text-info ms-1">Bạn chọn</span>' : ''}
    </li>
  `;
    });


      html += `</ul></div>`;
    });

    bodyEl.innerHTML = html;
  }

  // Attach events
  document.querySelectorAll(".js-view-attempt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = resultMap[btn.dataset.id];
      if (!item) return;
      renderAttemptDetail(item);
      modal.show();
    });
  });
});
