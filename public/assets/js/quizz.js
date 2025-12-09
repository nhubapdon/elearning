// public/assets/js/quizz.js

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("quizRoot");
  if (!root) return;

  // Lấy dữ liệu từ data-attributes
  const courseId = root.dataset.courseId;
  const quizId = root.dataset.quizId;
  let questions = [];

  try {
    questions = JSON.parse(root.dataset.questions || "[]");
  } catch (err) {
    console.error("Không parse được quiz questions:", err);
    return;
  }

  if (!questions.length) {
    console.warn("Quiz không có câu hỏi.");
    return;
  }

  const questionCard = document.getElementById("questionCard");
  const currentIndexEl = document.getElementById("currentQuestionIndex");
  const totalQuestionsEl = document.getElementById("totalQuestions");
  const progressFill = document.getElementById("quizProgressFill");
  const controls = document.getElementById("quizControls");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnSubmit = document.getElementById("btnSubmit");
  const messageEl = document.getElementById("quizMessage");
  const resultBox = document.getElementById("resultBox");

  const total = questions.length;
  totalQuestionsEl.textContent = total;

  let index = 0; // index của câu hỏi hiện tại
  const answers = {}; // { [questionId]: selectedIndex }

  function setMessage(msg) {
    if (!msg) {
      messageEl.classList.add("d-none");
      messageEl.textContent = "";
    } else {
      messageEl.textContent = msg;
      messageEl.classList.remove("d-none");
    }
  }

  function updateProgress() {
    const percent = ((index + 1) / total) * 100;
    progressFill.style.width = `${percent}%`;
  }

  function renderQuestion() {
    const q = questions[index];
    if (!q) return;

    // Update header
    currentIndexEl.textContent = index + 1;
    updateProgress();
    setMessage("");

    // Nội dung câu hỏi
    questionCard.innerHTML = "";
    questionCard.classList.remove("fade-slide");
    void questionCard.offsetWidth; // reset animation
    questionCard.classList.add("fade-slide");

    const title = document.createElement("h4");
    title.className = "question-title mb-3";
    title.textContent = `Câu ${index + 1}: ${q.question}`;
    questionCard.appendChild(title);

    const optionsWrapper = document.createElement("div");
    questionCard.appendChild(optionsWrapper);

    const selectedIndex = answers[q.id];

    (q.options || []).forEach((opt, optIndex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "option-btn w-100 mb-2 text-start btn btn-light border-0";

      if (selectedIndex === optIndex) {
        btn.classList.add("active");
      }

      btn.textContent = opt;

      btn.addEventListener("click", () => {
        answers[q.id] = optIndex;
        renderQuestion();
      });

      optionsWrapper.appendChild(btn);
    });

    // Nút điều hướng
    btnPrev.disabled = index === 0;
    btnNext.classList.toggle("d-none", index === total - 1);
    btnSubmit.classList.toggle("d-none", index !== total - 1);
  }

  btnPrev.addEventListener("click", () => {
    if (index === 0) return;
    index--;
    renderQuestion();
  });

  btnNext.addEventListener("click", () => {
    const q = questions[index];
    const selected = answers[q.id];

    if (selected == null) {
      setMessage("Bạn phải chọn đáp án trước khi sang câu tiếp theo.");
      return;
    }

    if (index < total - 1) {
      index++;
      renderQuestion();
    }
  });

  btnSubmit.addEventListener("click", async () => {
    // Kiểm tra đã trả lời hết chưa
    for (const q of questions) {
      if (answers[q.id] == null) {
        setMessage("Hãy trả lời tất cả câu hỏi trước khi nộp bài.");
        return;
      }
    }

    setMessage("");

    try {
      const res = await fetch(`/quizzes/${courseId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Có lỗi xảy ra khi nộp bài.");
        return;
      }

      showResult(data);
    } catch (err) {
      console.error("Lỗi submit quiz:", err);
      alert("Không thể nộp bài, vui lòng thử lại.");
    }
  });

  function showResult(data) {
    // Ẩn điều khiển câu hỏi
    controls.classList.add("d-none");
    questionCard.innerHTML = "";

    resultBox.classList.remove("d-none");
    resultBox.innerHTML = "";

      // ⭐⭐⭐ THÊM PASS / FAIL TẠI ĐÂY ⭐⭐⭐
  let statusHtml = "";
  if (data.score >= 80) {
    statusHtml = `
      <div class="alert alert-success rounded-3 p-3 mb-3 fw-semibold text-center">
        🎉 Chúc mừng! Bạn đã HOÀN THÀNH khóa học! (PASS)
      </div>`;
  } else if (data.score < 50) {
    statusHtml = `
      <div class="alert alert-danger rounded-3 p-3 mb-3 fw-semibold text-center">
        ❌ Bạn chưa đạt! Vui lòng làm lại để hoàn thành khóa học.
      </div>`;
  } else {
    statusHtml = `
      <div class="alert alert-warning rounded-3 p-3 mb-3 fw-semibold text-center">
        ⚠ Bạn chưa đạt mức hoàn thành. Hãy làm lại để nâng cao kết quả!
      </div>`;
  }

  resultBox.insertAdjacentHTML("beforeend", statusHtml);
  // ⭐⭐⭐ HẾT PHẦN THÊM ⭐⭐⭐

    const summary = document.createElement("div");
    summary.className = "p-3 rounded-3 mb-3 bg-light border";

    summary.innerHTML = `
      <h4 class="mb-2">Kết quả</h4>
      <p class="mb-1">Điểm: <b>${data.score}%</b></p>
      <p class="mb-0">Đúng <b>${data.correct}</b> / ${data.total} câu</p>
    `;

    resultBox.appendChild(summary);

    const detailTitle = document.createElement("h5");
    detailTitle.className = "mt-3 mb-3";
    detailTitle.textContent = "Đáp án chi tiết:";
    resultBox.appendChild(detailTitle);

    data.details.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "question-card mb-3";

      const title = document.createElement("p");
      title.className = "fw-semibold mb-2";
      title.textContent = `Câu ${idx + 1}: ${item.question}`;
      card.appendChild(title);

      const opts = document.createElement("div");
      card.appendChild(opts);

      const options =
        (questions.find((q) => q.id === item.questionId)?.options) || [];

      options.forEach((opt, optIndex) => {
        const btn = document.createElement("div");
        btn.className = "option-btn w-100 mb-2";

        btn.textContent = opt;

        if (optIndex === item.correctIndex) {
          btn.classList.add("correct");
        }

        if (
          item.userIndex != null &&
          optIndex === item.userIndex &&
          !item.isCorrect
        ) {
          btn.classList.add("wrong");
        }

        opts.appendChild(btn);
      });

      const footer = document.createElement("p");
      footer.className = "small mb-0 mt-2";

      if (item.isCorrect) {
        footer.innerHTML =
          '<span class="text-success fw-semibold">Bạn đã trả lời đúng câu này.</span>';
      } else {
        const userText =
          item.userAnswerText != null
            ? `Bạn chọn: <b>${item.userAnswerText}</b>. `
            : "Bạn chưa chọn đáp án. ";
        footer.innerHTML = `${userText}Đáp án đúng: <b>${item.correctText}</b>.`;
      }

      card.appendChild(footer);

      resultBox.appendChild(card);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // render lần đầu
  renderQuestion();
});
