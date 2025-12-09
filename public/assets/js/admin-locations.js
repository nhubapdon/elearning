document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const typeFilter = document.getElementById("typeFilter");
  const provinceFilter = document.getElementById("provinceFilter");
  const resetFilter = document.getElementById("resetFilter");
  const rows = Array.from(document.querySelectorAll("#locationTable tr"));

  function applyFilter() {
    const keyword = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const province = provinceFilter.value;

    rows.forEach(row => {
      const name = row.children[1].innerText.toLowerCase();
      const category = row.children[2].innerText.toLowerCase();
      const prov = row.children[4].innerText.toLowerCase();

      const matchKeyword = name.includes(keyword);
      const matchType = !type || category.includes(type);
      const matchProvince = !province || prov === province;

      row.style.display = (matchKeyword && matchType && matchProvince) ? "" : "none";
    });
  }

  searchInput.addEventListener("input", applyFilter);
  typeFilter.addEventListener("change", applyFilter);
  provinceFilter.addEventListener("change", applyFilter);

  resetFilter.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    provinceFilter.value = "";
    applyFilter();
  });
});
        /*-- Modal của trang create và edit -->*/
document.addEventListener("DOMContentLoaded", () => {

  const modal = new bootstrap.Modal(document.getElementById("previewModal"));
  const openPreview = document.getElementById("openPreview");
  const confirmSubmit = document.getElementById("confirmSubmit");

  const nameEl = document.querySelector("input[name='name']");
  const categoryEl = document.querySelector("select[name='category']");
  const addressEl = document.querySelector("input[name='address']");
  const phoneEl = document.querySelector("input[name='phone']");
  const openEl = document.querySelector("input[name='opening_hours']");
  const latEl = document.getElementById("latInput");
  const lngEl = document.getElementById("lngInput");

  const form = document.querySelector("form");

  openPreview.addEventListener("click", () => {
    document.getElementById("pv_name").innerText = nameEl.value;
    document.getElementById("pv_category").innerHTML =
      `<span class="badge bg-primary px-3 py-2">${categoryEl.options[categoryEl.selectedIndex].text}</span>`;
    document.getElementById("pv_address").innerText = addressEl.value;
    document.getElementById("pv_phone").innerText = phoneEl.value || "—";
    document.getElementById("pv_opening").innerText = openEl.value || "—";
    document.getElementById("pv_lat").innerText = latEl.value;
    document.getElementById("pv_lng").innerText = lngEl.value;

    modal.show();
  });

  confirmSubmit.addEventListener("click", () => {
    form.submit();
  });

});
        /*-- Modal của trang index -->*/
/*-- Modal xem bản đồ --*/
document.addEventListener("DOMContentLoaded", () => {

  let previewMap = null;
  let previewMarker = null;
  let routeControl = null;

  const modalEl = document.getElementById("mapPreviewModal");
  const modal = new bootstrap.Modal(modalEl);

  const btns = document.querySelectorAll(".open-map");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const name = btn.dataset.name;
      const address = btn.dataset.address;

      document.getElementById("mp_title").innerText = name;
      document.getElementById("mp_address").innerText = address;

      modal.show();

      setTimeout(() => {
        if (!previewMap) {
          previewMap = L.map("mp_map").setView([lat, lng], 17);

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19
          }).addTo(previewMap);

          previewMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: "/assets/images/marker-center2.svg",
              iconSize: [48, 48],
              iconAnchor: [24, 48]
            })
          }).addTo(previewMap);
          /* === ROUTING: Xem đường đi === */

let routingControl = null;

document.getElementById("openRoute").onclick = () => {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ định vị!");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      // Xóa route cũ nếu có
      if (routingControl) {
        previewMap.removeControl(routingControl);
        routingControl = null;
      }

      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(lat, lng)
        ],
        lineOptions: {
          styles: [{ color: "#007bff", weight: 6 }]
        },
        createMarker: function(i, wp) {
          return L.marker(wp.latLng, {
            icon: L.icon({
              iconUrl:
                i === 0
                  ? "/assets/images/marker-start.svg"
                  : "/assets/images/marker-center2.svg",
              iconSize: [40, 40],
              iconAnchor: [20, 40]
            })
          });
        },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: false
      }).addTo(previewMap);

      previewMap.setView([userLat, userLng], 14);
    },
    () => alert("Không thể lấy vị trí hiện tại!")
  );
};


        } else {
          previewMap.setView([lat, lng], 17);
          previewMarker.setLatLng([lat, lng]);

          if (routeControl) {
            previewMap.removeControl(routeControl);
            routeControl = null;
          }
        }

        setTimeout(() => previewMap.invalidateSize(), 120);

        /* ĐÓNG MODAL */
        document.getElementById("closeMapModal").onclick = () => {
          if (routeControl) {
            previewMap.removeControl(routeControl);
            routeControl = null;
          }
          modal.hide();
        };

        /* XEM ĐƯỜNG ĐI */
        document.getElementById("openRoute").onclick = () => {
          if (!navigator.geolocation) {
            alert("Trình duyệt không hỗ trợ định vị!");
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const userLat = pos.coords.latitude;
              const userLng = pos.coords.longitude;

              // Xóa route cũ
              if (routeControl) previewMap.removeControl(routeControl);

              routeControl = L.Routing.control({
                waypoints: [
                  L.latLng(userLat, userLng),
                  L.latLng(lat, lng)
                ],
                lineOptions: {
                  styles: [{ color: '#2563eb', weight: 6 }]
                },
                show: false,
                draggableWaypoints: false,
                addWaypoints: false
              }).addTo(previewMap);

              previewMap.setView([userLat, userLng], 13);
            },
            () => alert("Không thể lấy vị trí hiện tại!")
          );
        };

      }, 300);
    });
  });

});


