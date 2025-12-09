const revenueLabels = window.revenueLabels || [];
const revenueData = window.revenueData || [];

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  /* ===========================================================
        GRADIENT LINE (RED / ORANGE)
     =========================================================== */

  let shift = 0;

  function dynamicGradient() {
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0);

    // CHỌN MÀU (orange / red)
    const MODE = "orange"; // đổi thành "red" nếu muốn

    let c1, c2, c3;

    if (MODE === "orange") {
      c1 = "rgba(255,140,0,1)";
      c2 = "rgba(255,90,0,1)";
      c3 = "rgba(255,50,0,1)";
    } else {
      c1 = "rgba(255,70,70,1)";
      c2 = "rgba(255,35,35,1)";
      c3 = "rgba(255,0,0,1)";
    }

    g.addColorStop((shift + 0) % 1, c1);
    g.addColorStop((shift + 0.5) % 1, c2);
    g.addColorStop((shift + 1) % 1, c3);

    return g;
  }

  /* ===========================================================
        GLASS AREA FILL
     =========================================================== */

  const fill = ctx.createLinearGradient(0, 0, 0, 350);
  fill.addColorStop(0, "rgba(255,120,60,0.30)");
  fill.addColorStop(1, "rgba(255,120,60,0.03)");

  /* ===========================================================
        CUSTOM DARK LUXURY TOOLTIP (KHÔNG CÒN BUG)
     =========================================================== */

  let tooltipEl = null;

  function createTooltip() {
    tooltipEl = document.createElement("div");
    tooltipEl.style.position = "absolute";
    tooltipEl.style.padding = "10px 14px";
    tooltipEl.style.borderRadius = "12px";
    tooltipEl.style.background = "rgba(0,0,0,0.75)";
    tooltipEl.style.color = "white";
    tooltipEl.style.fontSize = "14px";
    tooltipEl.style.fontWeight = "600";
    tooltipEl.style.pointerEvents = "none";
    tooltipEl.style.opacity = "0";
    tooltipEl.style.transition = "0.15s ease";
    tooltipEl.style.zIndex = "99999";
    tooltipEl.style.backdropFilter = "blur(6px)";
    document.body.appendChild(tooltipEl);
  }

  createTooltip();

  /* ===========================================================
        CREATE CHART
     =========================================================== */

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: window.revenueLabels,
      datasets: [
        {
          data: window.revenueData,
          borderColor: () => dynamicGradient(),
          borderWidth: 4,
          fill: true,
          backgroundColor: fill,
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "rgba(255,120,0,1)",
          pointHoverBorderWidth: 3,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false, // TẮT HOÀN TOÀN TOOLTIP GỐC
          external: (ctxTip) => {
            const tooltip = ctxTip.tooltip;

            if (!tooltip || tooltip.opacity === 0) {
              tooltipEl.style.opacity = 0;
              return;
            }

            const value = tooltip.dataPoints[0].formattedValue;
            const label = tooltip.dataPoints[0].label;

            tooltipEl.innerHTML = `
              <div>${label}</div>
              <div style="font-size:16px;margin-top:2px">${Number(value).toLocaleString("vi-VN")} đ</div>
            `;

            const rect = canvas.getBoundingClientRect();
            tooltipEl.style.left = rect.left + tooltip.caretX + "px";
            tooltipEl.style.top = rect.top + tooltip.caretY - 50 + "px";
            tooltipEl.style.opacity = 1;
          },
        },
      },

      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#475569", font: { size: 13, weight: 600 } },
        },
        y: {
          grid: { color: "rgba(255,120,60,0.08)", drawBorder: false },
          ticks: {
            color: "#64748b",
            font: { size: 13 },
            callback: (v) => Number(v).toLocaleString("vi-VN"),
          },
        },
      },
    },
  });

  /* ===========================================================
        ANIMATE LINE COLOR SHIFT
     =========================================================== */

  function loop() {
    shift += 0.003;
    chart.update("none"); // no animation frame reset
    requestAnimationFrame(loop);
  }

  loop();
});


// USER DROPDOWN
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("userMenuBtn");
  const menu = document.getElementById("userDropdown");

  btn.addEventListener("click", () => {
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  // Ẩn khi click ra ngoài
  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target)) {
      menu.style.display = "none";
    }
  });
});
