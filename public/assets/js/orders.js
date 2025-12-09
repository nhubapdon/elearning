document.addEventListener("DOMContentLoaded", () => {
  createRevenueChart(window.revenueLabels || [], window.revenueValues || []);
  createOrdersBarChart(window.orderLabels || [], window.orderCounts || []);
});

/* ============================================================
   LINE CHART — DOANH THU (Ultra Luxury++)
   Fix: thêm padding dưới, chỉnh scale, cân bố cục
=============================================================== */
function createRevenueChart(labels, values) {
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // GRADIENT FILL (Cam luxury)
  const gradientFill = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradientFill.addColorStop(0, "rgba(249,115,22,0.25)");
  gradientFill.addColorStop(1, "rgba(249,115,22,0.03)");

  // Gradient line
  const gradientLine = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradientLine.addColorStop(0, "#fb923c");
  gradientLine.addColorStop(1, "#f97316");

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderWidth: 3.2,
          borderColor: gradientLine,
          backgroundColor: gradientFill,
          fill: true,
          tension: 0.42,

          pointRadius: 4.5,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#f97316",
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      layout: {
        padding: {
          top: 8,
          right: 10,
          bottom: 25,   // ⭐ FIX CHÍNH: thêm không gian dưới line chart
          left: 6,
        },
      },

      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.95)",
          cornerRadius: 12,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) =>
              `${Number(ctx.raw || 0).toLocaleString("vi-VN")} đ`,
          },
        },
      },

      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#475569",
            padding: 8,
            font: { size: 13, weight: 600 },
          },
        },

        y: {
          beginAtZero: false,
          grid: {
            color: "rgba(226,232,240,0.65)",
          },
          ticks: {
            color: "#94a3b8",
            padding: 6,
            callback: (v) => Number(v).toLocaleString("vi-VN"),
          },
        },
      },

      elements: {
        line: {
          borderCapStyle: "round",
          borderJoinStyle: "round",
        },
      },
    },
  });
}

/* ============================================================
   BAR CHART — SỐ LƯỢNG ĐƠN (Luxury Premium)
=============================================================== */
function createOrdersBarChart(labels, values) {
  const canvas = document.getElementById("ordersChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Bar gradient xanh lá
  const barGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  barGradient.addColorStop(0, "rgba(34,197,94,0.95)");
  barGradient.addColorStop(1, "rgba(22,163,74,0.75)");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: barGradient,
          borderRadius: 10,
          borderSkipped: false,

          // Bar thickness đẹp — không quá dày
          barThickness: 30,
          maxBarThickness: 36,
          categoryPercentage: 0.55,
          barPercentage: 0.72,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 0,   // đồng bộ với line chart
          left: 6,
        },
      },

      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.95)",
          cornerRadius: 12,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${ctx.raw || 0} đơn`,
          },
        },
      },

      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#475569",
            padding: 8,
            font: { size: 13, weight: 600 },
          },
        },

        y: {
          grid: {
            color: "rgba(226,232,240,1)",
          },
          ticks: {
            color: "#94a3b8",
            padding: 6,
            precision: 0,
          },
        },
      },
    },
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".filter-wrapper");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(new FormData(form));

    // Fetch HTML partial (refresh bảng + stats mà không reload trang)
    const res = await fetch(`/dashboard/orders?${params.toString()}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    const html = await res.text();

    // Parse để lấy nội dung bảng + stat
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Thay nội dung vào DOM
    document.querySelector(".orders-table-card").innerHTML =
      doc.querySelector(".orders-table-card").innerHTML;

    document.querySelector(".orders-stats-grid").innerHTML =
      doc.querySelector(".orders-stats-grid").innerHTML;
  });
});
