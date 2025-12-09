function getMarkerIcon(category) {
  switch (category) {
    case "lab":
      return L.icon({
        iconUrl: "/assets/images/marker-lab.svg",
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48]
      });

    case "workshop":
      return L.icon({
        iconUrl: "/assets/images/marker-workshop.svg",
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48]
      });

    case "exam":
      return L.icon({
        iconUrl: "/assets/images/marker-exam.svg",
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48]
      });

    case "center":  // ⭐ DÙNG ICON ĐẶC BIỆT CHO CƠ SỞ TRUNG TÂM
      return L.icon({
        iconUrl: "/assets/images/marker-center.svg",
        iconSize: [56, 78],     // đẹp hơn để trung tâm nổi bật
        iconAnchor: [28, 78],
        popupAnchor: [0, -78]
      });

    default:
      return L.icon({
        iconUrl: "/assets/images/marker-center.svg",
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48]
      });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const mapContainer = document.getElementById("trainingMap");
  if (!mapContainer) return;

  /* ===== INIT MAP ===== */
  const map = L.map("trainingMap", {
    zoomControl: true,
  }).setView([10.776, 106.700], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  // Fix xé ô khi container thay đổi
  setTimeout(() => map.invalidateSize(), 300);
  

  /* ===== FETCH DATA ===== */
  const res = await fetch("/map/locations");
  const json = await res.json();
  const locations = json.data || json; // phòng trường hợp API trả dạng {data:[]}

  /* ===== DOM ELEMENTS ===== */
  const listEl = document.getElementById("locationList");
  const searchInput = document.getElementById("mapSearchInput");
  const provinceSelect = document.getElementById("mapProvinceFilter");
  const typePills = document.querySelectorAll(".lux-type-pill");

  const modalBackdrop = document.getElementById("locationModal");
  const modalName = document.getElementById("modalName");
  const modalType = document.getElementById("modalType");
  const modalAddress = document.getElementById("modalAddress");
  const modalPhone = document.getElementById("modalPhone");
  const modalHours = document.getElementById("modalHours");
  const modalFocusBtn = document.getElementById("modalFocusBtn");
  const modalCloseBtn = modalBackdrop?.querySelector(".lux-modal-close");

  const darkToggle = document.getElementById("darkToggle");
  const luxHeader = document.getElementById("luxHeader");

  /* ===== STATE ===== */
  const markers = [];
  let currentType = "";
  let currentLocation = null;

  /* ===== HELPERS ===== */

const typeLabelMap = {
  center: "Cơ sở đào tạo",
  lab: "Phòng lab / thực hành",
  workshop: "Workshop / sự kiện",
  exam: "Điểm thi"
};

function getTypeLabel(code) {
  return typeLabelMap[code] || "Khác";
}


function matchesFilters(loc, keyword, province, typeCode) {
  const name = (loc.name || "").toLowerCase();
  const addr = (loc.address || "").toLowerCase();

  const kwOk = !keyword || name.includes(keyword) || addr.includes(keyword);

  const provOk = province
    ? (loc.province_code || "").toLowerCase() === province.toLowerCase()
    : true;

  const typeOk = typeCode ? (loc.category || "") === typeCode : true;

  return kwOk && provOk && typeOk;
}


  function openModal(loc) {
    if (!modalBackdrop) return;
    currentLocation = loc;

    modalName.textContent = loc.name || "";
    modalType.textContent = getTypeLabel(loc.type);
    modalAddress.textContent = loc.address || "Đang cập nhật";
    modalPhone.textContent = loc.phone || "Đang cập nhật";
    modalHours.textContent =
      loc.opening_hours || "Thời gian hoạt động linh hoạt";

    modalBackdrop.classList.add("show");
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("show");
  }

  /* ===== MARKERS ===== */
  locations.forEach((loc) => {
    if (!loc.lat || !loc.lng) return;

    // Custom E-Learning Marker (SVG)
const elearningIcon = L.icon({
  iconUrl: "/assets/images/marker-elearning.svg",
  iconSize: [46, 46],  
  iconAnchor: [23, 46],  
  popupAnchor: [0, -46]
});

// Render marker
const marker = L.marker([loc.lat, loc.lng], {
  icon: getMarkerIcon(loc.category)
}).addTo(map);


    marker._loc = loc;

    const popupHtml = `
      <div class="lux-popup">
        <div class="lux-popup-title">${loc.name || ""}</div>
        <div class="lux-loc-type">${getTypeLabel(loc.category)}</div>

        <div class="lux-popup-address">${loc.address || ""}</div>
      </div>
    `;

    marker.bindPopup(`
  <div class="lux-popup">
      <div class="lux-popup-header">
        <span class="lux-cat">${loc.category || "Cơ sở"}</span>
      </div>

      <h4 class="lux-popup-title">${loc.name}</h4>

      <div class="lux-popup-line">
        <i class="bi bi-geo-alt"></i> ${loc.address}
      </div>

      ${loc.phone ? `<div class="lux-popup-line"><i class="bi bi-telephone"></i> ${loc.phone}</div>` : ""}

      <div class="lux-popup-line"><i class="bi bi-clock"></i> ${loc.opening_hours || "Giờ linh hoạt"}</div>
  </div>
`, {
  className: "lux-map-popup"
});


    marker.on("click", () => {
      currentLocation = loc;
    });

    markers.push(marker);
  });

  if (markers.length) {
    const group = new L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.15));
  }

  /* ===== RENDER LIST ===== */
  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";

    const keyword = (searchInput?.value || "").trim().toLowerCase();
    const province = provinceSelect?.value || "";
    const typeCode = currentType;

    locations
      .filter((loc) => matchesFilters(loc, keyword, province, typeCode))
      .forEach((loc) => {
        const item = document.createElement("div");
        item.className = "lux-location-card";

        item.innerHTML = `
          <div class="lux-loc-type">${getTypeLabel(loc.category)}</div>

          <div class="lux-loc-name">${loc.name || ""}</div>
          <div class="lux-loc-address">${loc.address || ""}</div>
          <div class="lux-loc-meta">
            <span><i class="bi bi-clock"></i> ${
              loc.opening_hours || "Linh hoạt"
            }</span>
            ${
              loc.phone
                ? `<span><i class="bi bi-telephone"></i> ${loc.phone}</span>`
                : ""
            }
          </div>
          <div class="lux-loc-actions">
            <button class="lux-loc-detail-btn" type="button">
              Chi tiết
            </button>
          </div>
        `;

        // click card -> focus map + mở popup
        item.addEventListener("click", () => {
          const marker = markers.find((m) => m._loc && m._loc.id === loc.id);
          if (marker) {
            map.setView(marker.getLatLng(), 15);
            marker.openPopup();
          }
        });

        // nút Chi tiết -> modal
        const detailBtn = item.querySelector(".lux-loc-detail-btn");
        detailBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openModal(loc);
        });

        listEl.appendChild(item);
      });
  }

  /* ===== EVENTS ===== */

  // Search & filter
  searchInput?.addEventListener("input", () => renderList());
  provinceSelect?.addEventListener("change", () => renderList());

  // Type pills
  typePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      typePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentType = pill.dataset.typeFilter || "";
      renderList();
    });
  });

  // Modal events
  modalCloseBtn?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  modalFocusBtn?.addEventListener("click", () => {
    if (!currentLocation) return;
    const marker = markers.find(
      (m) => m._loc && m._loc.id === currentLocation.id
    );
    if (marker) {
      map.setView(marker.getLatLng(), 15);
      marker.openPopup();
    }
    closeModal();
  });

  // Header scroll effect
  if (luxHeader) {
    const onScroll = () => {
      if (window.scrollY > 10) luxHeader.classList.add("scrolled");
      else luxHeader.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
  }

  // Dark mode toggle
  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      const body = document.body;
      const isDarkNow = body.classList.toggle("lux-dark");
      darkToggle.innerHTML = isDarkNow
        ? '<i class="bi bi-sun"></i>'
        : '<i class="bi bi-moon"></i>';
    });
  }

  // Render lần đầu
  renderList();
});
