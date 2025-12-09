(() => {
  // ====== DATA TỪ EJS ĐƯỢC GHI TRỰC TIẾP VÀO HTML ======
  const activityLabels = window.userActivityLabels;
  const dataValues = window.userActivityValues;
  const colors = window.userActivityColors;

  // ==== VẼ BIỂU ĐỒ ====
  const ctx = document.getElementById("userActivityChart");

  if (ctx) {
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: activityLabels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: colors,
            borderWidth: 8,
            borderColor: "#fff",
            hoverBorderColor: "#fff",
            cutout: "75%", 
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // ==== CUSTOM LEGEND ====
  const legendEl = document.getElementById("userActivityLegend");

  if (legendEl) {
    const total = dataValues.reduce((a, b) => a + b, 0) || 1;

    activityLabels.forEach((label, idx) => {
      const percent = Math.round((dataValues[idx] / total) * 100);

      const li = document.createElement("li");
      li.className =
        "d-flex justify-content-between align-items-center mb-2 chart-legend-item";

      li.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="chart-dot" style="background:${colors[idx]}"></span>
          <span>${label}</span>
        </div>
        <span class="fw-semibold">${percent}%</span>
      `;

      legendEl.appendChild(li);
    });
  }

  // ==== EXPORT PDF ====
  const btnPdf = document.getElementById("btnExportPdf");

  if (btnPdf) {
    btnPdf.addEventListener("click", async () => {
      const { jsPDF } = window.jspdf;
      const captureArea = document.querySelector(".admin-users-page");

      await new Promise((r) => setTimeout(r, 300));

      html2canvas(captureArea, { scale: 2 }).then((canvas) => {
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;

        pdf.addImage(img, "PNG", 0, 0, width, height);
        pdf.save(`user-detail-${Date.now()}.pdf`);
      });
    });
  }
})();
