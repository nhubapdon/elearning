// public/assets/js/dashboard-quiz-builder.js

document.addEventListener("DOMContentLoaded", () => {
  const questionsBox = document.getElementById("questionsBox");
  const btnAdd = document.getElementById("btnAddQuestion");
  const btnPreview = document.getElementById("btnPreviewQuiz");
  const quizForm = document.getElementById("quizForm");
  const questionsJsonInput = document.getElementById("questionsJson");

  let questions = [];

  // Nếu đang ở chế độ EDIT thì lấy dữ liệu ban đầu từ window.quizInitialQuestions
  if (
    Array.isArray(window.quizInitialQuestions) &&
    window.quizInitialQuestions.length > 0
  ) {
    questions = window.quizInitialQuestions.map((q) => ({
      id: q.id || null,
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct_index:
        typeof q.correct_index === "number" ? q.correct_index : 0,
    }));
  }

  // Tạo card câu hỏi
  function createQuestionCard(qIndex) {
    const q = questions[qIndex];

    // Đảm bảo luôn có 4 options
    while (q.options.length < 4) {
      q.options.push("");
    }

    const card = document.createElement("div");
    card.className =
      "card shadow-sm border-0 rounded-4 mb-3 question-card-item";
    card.dataset.index = qIndex;

    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0 fw-semibold">Câu hỏi #${qIndex + 1}</h6>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-pill btnRemoveQuestion">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="mb-3">
          <label class="form-label small fw-semibold">Nội dung câu hỏi</label>
          <textarea class="form-control question-text" rows="2" placeholder="Nhập nội dung câu hỏi...">${q.question}</textarea>
        </div>

        <div class="mb-2">
          <label class="form-label small fw-semibold">Các đáp án</label>
        </div>

        ${q.options
          .map(
            (opt, optIndex) => `
          <div class="input-group mb-2 option-row" data-opt-index="${optIndex}">
            <span class="input-group-text">${optIndex + 1}</span>
            <input 
              type="text" 
              class="form-control option-input" 
              value="${opt || ""}" 
              placeholder="Đáp án ${optIndex + 1}"
            >
            <div class="input-group-text">
              <input 
                class="form-check-input mt-0 correct-radio" 
                type="radio" 
                name="correct-${qIndex}"
                ${q.correct_index === optIndex ? "checked" : ""}
              >
              <span class="ms-1 small">Đúng</span>
            </div>
          </div>
        `
          )
          .join("")}

        <div class="mt-1">
          <span class="form-text small">
            Chọn một đáp án đúng cho câu hỏi này.
          </span>
        </div>
      </div>
    `;

    // Xoá câu hỏi
    card
      .querySelector(".btnRemoveQuestion")
      .addEventListener("click", () => {
        questions.splice(qIndex, 1);
        renderQuestions();
      });

    // Sửa nội dung câu hỏi
    card.querySelector(".question-text").addEventListener("input", (e) => {
      questions[qIndex].question = e.target.value;
    });

    // Sửa từng đáp án
    card.querySelectorAll(".option-input").forEach((inputEl, optIndex) => {
      inputEl.addEventListener("input", (e) => {
        questions[qIndex].options[optIndex] = e.target.value;
      });
    });

    // Chọn đáp án đúng
    card.querySelectorAll(".correct-radio").forEach((radioEl, optIndex) => {
      radioEl.addEventListener("change", () => {
        questions[qIndex].correct_index = optIndex;
      });
    });

    return card;
  }

  // Render danh sách câu hỏi
  function renderQuestions() {
    questionsBox.innerHTML = "";

    if (questions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-muted small";
      empty.textContent =
        "Chưa có câu hỏi nào. Hãy nhấn 'Thêm câu hỏi' để bắt đầu.";
      questionsBox.appendChild(empty);
      return;
    }

    questions.forEach((_, idx) => {
      const card = createQuestionCard(idx);
      questionsBox.appendChild(card);
    });
  }

  // Đồng bộ dữ liệu từ DOM vào mảng questions
  function syncQuestionsFromDOM() {
    const cards = questionsBox.querySelectorAll(".question-card-item");

    cards.forEach((card) => {
      const qIndex = Number(card.dataset.index);
      const q = questions[qIndex];
      if (!q) return;

      const qText = card.querySelector(".question-text")?.value || "";
      q.question = qText;

      const optionInputs = card.querySelectorAll(".option-input");
      q.options = Array.from(optionInputs).map(
        (input) => input.value || ""
      );

      // Nếu correct_index out-of-range thì đưa về 0
      if (q.correct_index < 0 || q.correct_index >= q.options.length) {
        q.correct_index = 0;
      }
    });

    // Bỏ những câu hỏi rỗng hoàn toàn
    questions = questions.filter(
      (q) => q.question && q.question.trim() !== ""
    );
  }

  // Thêm câu hỏi mới
  btnAdd?.addEventListener("click", () => {
    questions.push({
      id: null,
      question: "",
      options: ["", "", "", ""],
      correct_index: 0,
    });
    renderQuestions();
  });

  // 🔍 XEM TRƯỚC BÀI KIỂM TRA – chỉ dùng client-side + Bootstrap Modal
  btnPreview?.addEventListener("click", () => {
    // Gom dữ liệu mới nhất
    syncQuestionsFromDOM();

    if (questions.length === 0) {
      alert("Bạn chưa tạo câu hỏi nào để xem trước.");
      return;
    }

    const previewContent = document.getElementById("previewContent");
    previewContent.innerHTML = "";

    // Tiêu đề quiz
    const titleEl = document.createElement("h5");
    titleEl.className = "fw-bold mb-3";
    titleEl.textContent =
      document.querySelector("input[name='title']")?.value ||
      "Bài kiểm tra (chưa đặt tên)";
    previewContent.appendChild(titleEl);

    // Danh sách câu hỏi + đáp án
    questions.forEach((q, idx) => {
      const block = document.createElement("div");
      block.className = "mb-3";

      const qTitle = document.createElement("p");
      qTitle.className = "fw-semibold mb-1";
      qTitle.textContent = `Câu ${idx + 1}: ${
        q.question || "(chưa nhập câu hỏi)"
      }`;
      block.appendChild(qTitle);

      const list = document.createElement("ul");
      list.className = "mb-0";

      q.options.forEach((opt, optIndex) => {
        if (!opt) return;
        const li = document.createElement("li");
        if (optIndex === q.correct_index) {
          li.innerHTML = `<b>${opt}</b> <span class="badge bg-success ms-1">Đáp án đúng</span>`;
        } else {
          li.textContent = opt;
        }
        list.appendChild(li);
      });

      block.appendChild(list);
      previewContent.appendChild(block);
    });

    // Mở modal Bootstrap
    const modalEl = document.getElementById("quizPreviewModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  // Trước khi submit form -> đưa JSON câu hỏi vào hidden input
  quizForm?.addEventListener("submit", (e) => {
    syncQuestionsFromDOM();

    if (questions.length === 0) {
      e.preventDefault();
      alert("Bạn cần tạo ít nhất 1 câu hỏi cho bài kiểm tra.");
      return;
    }

    questionsJsonInput.value = JSON.stringify(questions);
  });

  // Render lần đầu
  renderQuestions();
});
