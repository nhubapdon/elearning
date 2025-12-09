document.addEventListener("DOMContentLoaded", () => {

  const map = L.map("map").setView([10.77, 106.67], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  // FIX tile bị bể khi load map trong container động
  setTimeout(() => {
    map.invalidateSize(true);
  }, 500);

});
