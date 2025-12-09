document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("adminMap");
  if (!mapEl) return; // Không phải trang create/edit

  const latInput = document.getElementById("latInput");
  const lngInput = document.getElementById("lngInput");
  const searchBox = document.getElementById("mapSearchBox");
  const resetBtn = document.getElementById("resetBtn");

  // Nếu lat/lng đã có -> đang ở trang EDIT
  const defaultLat = latInput?.value
    ? parseFloat(latInput.value)
    : 16.047079;

  const defaultLng = lngInput?.value
    ? parseFloat(lngInput.value)
    : 108.206230;

  // Nếu đang EDIT (lat/lng có sẵn) → zoom gần
const defaultZoom = latInput?.value ? 16 : 6;

const map = L.map("adminMap").setView([defaultLat, defaultLng], defaultZoom);


  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  // Marker
  let marker = L.marker([defaultLat, defaultLng], { draggable: false }).addTo(map);

  // Nếu create → fill mặc định
  if (!latInput.value) latInput.value = defaultLat;
  if (!lngInput.value) lngInput.value = defaultLng;

  function updateLatLng(lat, lng) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
  }

  // Click trên map
  map.on("click", function (e) {
    const { lat, lng } = e.latlng;
    marker.setLatLng([lat, lng]);
    updateLatLng(lat, lng);
  });

  // Reset
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      marker.setLatLng([defaultLat, defaultLng]);
      map.setView([defaultLat, defaultLng], 16);
      updateLatLng(defaultLat, defaultLng);
    });
  }

  // Search Nominatim
  // === SEARCH BAR NEW VERSION ===
const searchInput = document.getElementById("searchAddress");
const searchBtn = document.getElementById("searchBtn");

async function searchLocation() {
  const query = searchInput.value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      map.setView([lat, lng], 14);

      marker.setLatLng([lat, lng]);

      updateLatLng(lat, lng);
    } else {
      alert("❌ Không tìm thấy vị trí phù hợp!");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Lỗi khi tìm kiếm vị trí!");
  }
}

// Bấm Enter
if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchLocation();
    }
  });
}

// Bấm nút search
if (searchBtn) {
  searchBtn.addEventListener("click", () => searchLocation());
}
map.on("click", function (e) {
  const { lat, lng } = e.latlng;
  marker.setLatLng([lat, lng]);
  updateLatLng(lat, lng);
  map.setView([lat, lng], 18); // ← tự zoom vào điểm vừa chọn
});

});
