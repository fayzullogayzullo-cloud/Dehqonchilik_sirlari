(function(){
  const center = [41.311081, 69.240562];
  const map = L.map('map', { zoomControl:false }).setView(center, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // add custom zoom control to bottom right for nicer look
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Locate control (simple custom button)
  const locateControl = L.control({ position: 'bottomright' });
  locateControl.onAdd = function(){
    const div = L.DomUtil.create('div', 'leaflet-control custom-locate');
    div.innerHTML = '<button id="locate-btn" title="Sizni aniqlash" style="background:transparent;border:0;cursor:pointer;font-weight:600">📍 Men</button>';
    return div;
  };
  locateControl.addTo(map);
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'locate-btn'){
      map.locate({ setView:true, maxZoom:15 });
    }
  });

  map.on('locationfound', (e)=>{
    const radius = Math.round(e.accuracy);
    if(window.userLocMarker) map.removeLayer(window.userLocMarker);
    window.userLocMarker = L.circle(e.latlng, { radius, color:'#2a9d8f', fillColor:'#2a9d8f', fillOpacity:0.12 }).addTo(map);
  });

  // custom driver icon using divIcon
  function driverIcon(name){
    return L.divIcon({
      className: 'driver-marker',
      html: `<div style="background:linear-gradient(180deg,#ff8f3d,#ff6b00);color:white;padding:6px 8px;border-radius:10px;font-weight:700;font-size:12px">${name[0]}</div>`,
      iconSize: [36,36],
      iconAnchor: [18,36]
    });
  }

  const drivers = [
    { id: 1, name: "Ali", car: "Chevrolet Nexia", lat: 41.316, lng: 69.281 },
    { id: 2, name: "Dilshod", car: "Spark", lat: 41.299, lng: 69.240 },
    { id: 3, name: "Mira", car: "Gentra", lat: 41.327, lng: 69.220 },
    { id: 4, name: "Javlon", car: "Cobalt", lat: 41.305, lng: 69.210 }
  ];

  const driverMarkers = {};
  drivers.forEach(d => {
    const m = L.marker([d.lat, d.lng], { title: d.name, icon: driverIcon(d.name) }).addTo(map)
      .bindPopup(`<strong>${d.name}</strong><br>${d.car}`);
    driverMarkers[d.id] = m;
  });

  // DOM
  const pickupInput = document.getElementById('pickup-input');
  const dropInput = document.getElementById('dropoff-input');
  const requestBtn = document.getElementById('request-ride-btn');
  const driversListEl = document.getElementById('drivers-list');
  const estimationEl = document.getElementById('estimation');
  const statusEl = document.getElementById('ride-status');
  const setPickupBtn = document.getElementById('set-pickup-btn');
  const setDropBtn = document.getElementById('set-drop-btn');

  let pickupMarker = null;
  let dropMarker = null;
  let selecting = null; // 'pickup' or 'dropoff'
  let activeRide = null;
  let driverRouteLine = null;
  let routeLine = null; // between pickup and dropoff

  function toRad(v){ return v * Math.PI / 180; }
  function haversine(a,b){
    const R = 6371;
    const dLat = toRad(b[0]-a[0]);
    const dLon = toRad(b[1]-a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const x = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.sin(dLon/2)*Math.sin(dLon/2)*Math.cos(lat1)*Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    return R * c; // km
  }

  function estimateFare(km){
    const base = 2000;
    const perKm = 800;
    return Math.round(base + perKm * km);
  }

  function formatSom(x){ return x.toLocaleString('uz-UZ') + " so'm"; }

  function renderDriversList(){
    driversListEl.innerHTML = '';
    if(!pickupMarker){ driversListEl.innerHTML = '<li>Avval pickup tanlang.</li>'; return; }
    const pickup = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    const annotated = drivers.map(d => ({...d, dist: haversine(pickup, [d.lat,d.lng])})).sort((a,b)=>a.dist-b.dist);
    annotated.forEach(d => {
      const li = document.createElement('li');
      li.className = 'driver-item';
      li.innerHTML = `<div class="meta"><strong>${d.name}</strong><br>${d.car}<br>${d.dist.toFixed(2)} km</div>
                      <div><button data-id="${d.id}" class="select-driver btn">Tanlash</button></div>`;
      driversListEl.appendChild(li);
    });
    document.querySelectorAll('.select-driver').forEach(btn=>{
      btn.addEventListener('click', (e)=>{ selectDriver(Number(e.currentTarget.dataset.id)); });
    });
  }

  function updateEstimation(){
    if(!pickupMarker || !dropMarker){ estimationEl.textContent = 'Manzillar tanlanmagan.'; return; }
    const p = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    const d = [dropMarker.getLatLng().lat, dropMarker.getLatLng().lng];
    const km = haversine(p,d);
    const fare = estimateFare(km);
    estimationEl.innerHTML = `Masofa: <strong>${km.toFixed(2)} km</strong><br>Taxminiy narx: <strong>${formatSom(fare)}</strong>`;

    // draw route polyline
    if(routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([p,d], {color:'#2a9d8f', weight:4, opacity:0.9}).addTo(map);
    map.fitBounds(routeLine.getBounds(), {padding:[60,60]});
  }

  function selectDriver(id){
    const drv = drivers.find(x=>x.id===id); if(!drv) return;
    if(driverRouteLine) map.removeLayer(driverRouteLine);
    const driverLatLng = [drv.lat, drv.lng];
    const pickupLatLng = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    driverRouteLine = L.polyline([driverLatLng,pickupLatLng], {color:'#ff6b00', dashArray:'6', weight:3}).addTo(map);
    map.fitBounds(L.latLngBounds([driverLatLng,pickupLatLng, ...(routeLine?routeLine.getLatLngs():[]) ]), {padding:[60,60]});
    activeRide = { driver: drv, status: 'kutilmoqda', etaToPickupMin: Math.max(2, Math.round(haversine(driverLatLng,pickupLatLng)/0.6)) };
    statusEl.innerHTML = `Siz <strong>${drv.name}</strong> haydovchisini tanladingiz. Haydovchi yo'lga chiqmoqda. ETA: ${activeRide.etaToPickupMin} min.`;
  }

  map.on('click', (e) => {
    if(!selecting) return;
    if(selecting === 'pickup') {
      if(pickupMarker) map.removeLayer(pickupMarker);
      pickupMarker = L.marker(e.latlng, {draggable:true}).addTo(map).bindPopup('Pickup').openPopup();
      pickupInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      pickupMarker.on('dragend', () => { updateEstimation(); renderDriversList(); });
      renderDriversList(); updateEstimation();
    } else if(selecting === 'dropoff'){
      if(dropMarker) map.removeLayer(dropMarker);
      dropMarker = L.marker(e.latlng, {draggable:true}).addTo(map).bindPopup('Dropoff').openPopup();
      dropInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      dropMarker.on('dragend', () => { updateEstimation(); });
      updateEstimation();
    }
    selecting = null; setPickupBtn.textContent = "Xaritada pickup qo'ying"; setDropBtn.textContent = "Xaritada dropoff qo'ying";
  });

  setPickupBtn.addEventListener('click', () => { selecting = (selecting === 'pickup') ? null : 'pickup'; setPickupBtn.textContent = selecting === 'pickup' ? 'Xaritada bosing (bekor qilish uchun yana bosing)' : "Xaritada pickup qo'ying"; });
  setDropBtn.addEventListener('click', () => { selecting = (selecting === 'dropoff') ? null : 'dropoff'; setDropBtn.textContent = selecting === 'dropoff' ? 'Xaritada bosing (bekor qilish uchun yana bosing)' : "Xaritada dropoff qo'ying"; });

  function jitterDrivers(){ drivers.forEach(d=>{ const jitter=(Math.random()-0.5)*0.0012; d.lat+=jitter; d.lng+=jitter; const m=driverMarkers[d.id]; if(m){ m.setLatLng([d.lat,d.lng]); } }); }
  setInterval(jitterDrivers, 5000);

  requestBtn.addEventListener('click', () => {
    if(!pickupMarker || !dropMarker){ alert("Iltimos pickup va dropoff manzillarini tanlang."); return; }
    if(!activeRide){ const p=[pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng]; const nearest = drivers.map(d=>({...d, dist:haversine(p,[d.lat,d.lng])})).sort((a,b)=>a.dist-b.dist)[0]; selectDriver(nearest.id); }
    statusEl.innerHTML = 'Buyurtma yuborildi. Haydovchiga yuborilmoqda...';
    setTimeout(()=>{ if(!activeRide) return; activeRide.status='qabul qildi'; statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> buyurtmani qabul qildi. Yo'lda: ${activeRide.etaToPickupMin} min.`;
      let remaining = activeRide.etaToPickupMin; const tick = setInterval(()=>{ remaining=Math.max(0,remaining-1); statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> yo'lda. Kelish: ${remaining} min.`; if(remaining<=0){ clearInterval(tick); activeRide.status='yetib keldi'; statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> yetib keldi. Yozilgan manzilga chiqing.`; setTimeout(()=>{ activeRide.status='boshladi'; statusEl.innerHTML = `Safar boshlandi. Iltimos xavfsiz joyda o'tiring.`; const p=[pickupMarker.getLatLng().lat,pickupMarker.getLatLng().lng]; const d=[dropMarker.getLatLng().lat,dropMarker.getLatLng().lng]; const km=haversine(p,d); const etaDrop=Math.max(3, Math.round(km/0.6)); let rem2=etaDrop; const tick2=setInterval(()=>{ rem2=Math.max(0,rem2-1); statusEl.innerHTML = `Safar davom etmoqda. Yetib borish: ${rem2} min.`; if(rem2<=0){ clearInterval(tick2); activeRide.status='yakunlandi'; statusEl.innerHTML = `Safar tugadi. Rahmat!`; activeRide=null; if(driverRouteLine){ map.removeLayer(driverRouteLine); driverRouteLine=null; } } }, 1000); }, 1500); } }, 1000); }, 2000);
  });

  pickupInput.addEventListener('change', () => {
    const v = pickupInput.value.split(',').map(s=>s.trim()); if(v.length===2 && !isNaN(Number(v[0]))){ const lat=Number(v[0]), lng=Number(v[1]); if(pickupMarker) map.removeLayer(pickupMarker); pickupMarker = L.marker([lat,lng], {draggable:true}).addTo(map).bindPopup('Pickup').openPopup(); map.setView([lat,lng], 13); renderDriversList(); updateEstimation(); }
  });
  dropInput.addEventListener('change', () => {
    const v = dropInput.value.split(',').map(s=>s.trim()); if(v.length===2 && !isNaN(Number(v[0]))){ const lat=Number(v[0]), lng=Number(v[1]); if(dropMarker) map.removeLayer(dropMarker); dropMarker = L.marker([lat,lng], {draggable:true}).addTo(map).bindPopup('Dropoff').openPopup(); map.setView([lat,lng], 13); updateEstimation(); }
  });

  renderDriversList(); updateEstimation();
})();
