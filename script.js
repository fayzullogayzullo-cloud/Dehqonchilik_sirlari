(function(){
  // Map marklari va boshlang'ich koordinatalar (Toshkent markazi kabi)
  const center = [41.311081, 69.240562];
  const map = L.map('map').setView(center, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Sample drivers (tasodifiy/ mock)
  const drivers = [
    { id: 1, name: "Ali", car: "Chevrolet Nexia", lat: 41.316, lng: 69.281 },
    { id: 2, name: "Dilshod", car: "Spark", lat: 41.299, lng: 69.240 },
    { id: 3, name: "Mira", car: "Gentra", lat: 41.327, lng: 69.220 },
    { id: 4, name: "Javlon", car: "Cobalt", lat: 41.305, lng: 69.210 }
  ];

  const driverMarkers = {};
  drivers.forEach(d => {
    const m = L.marker([d.lat, d.lng], { title: d.name }).addTo(map)
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
  let activeRide = null; // object when ride requested
  let driverRouteLine = null;

  // Helpers
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
    const base = 2000; // so'm
    const perKm = 800; // so'm per km
    return Math.round(base + perKm * km);
  }

  function formatSo'm(x){
    return x.toLocaleString('uz-UZ') + " so'm";
  }

  function renderDriversList(){
    driversListEl.innerHTML = '';
    if(!pickupMarker){ driversListEl.innerHTML = '<li>Avval pickup tanlang.</li>'; return; }
    const pickup = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    const annotated = drivers.map(d => {
      const dist = haversine(pickup, [d.lat,d.lng]);
      return {...d, dist};
    }).sort((a,b) => a.dist - b.dist);
    annotated.forEach(d => {
      const li = document.createElement('li');
      li.className = 'driver-item';
      li.innerHTML = `<div class="meta"><strong>${d.name}</strong><br>${d.car}<br>${d.dist.toFixed(2)} km</div>
                      <div><button data-id="${d.id}" class="select-driver">Tanlash</button></div>`;
      driversListEl.appendChild(li);
    });
    document.querySelectorAll('.select-driver').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = Number(e.currentTarget.dataset.id);
        selectDriver(id);
      });
    });
  }

  function updateEstimation(){
    if(!pickupMarker || !dropMarker){ estimationEl.textContent = 'Manzillar tanlanmagan.'; return; }
    const p = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    const d = [dropMarker.getLatLng().lat, dropMarker.getLatLng().lng];
    const km = haversine(p,d);
    const fare = estimateFare(km);
    estimationEl.innerHTML = `Masofa: ${km.toFixed(2)} km<br>Taxminiy narx: ${formatSo'm(fare)}`;
  }

  function selectDriver(id){
    const drv = drivers.find(x=>x.id===id);
    if(!drv){ return; }
    // Mark driver on map
    if(driverRouteLine){ map.removeLayer(driverRouteLine); driverRouteLine = null; }
    const driverLatLng = [drv.lat, drv.lng];
    const pickupLatLng = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
    driverRouteLine = L.polyline([driverLatLng,pickupLatLng], {color:'#ff6b00', dashArray:'6'}).addTo(map);
    map.fitBounds([driverLatLng, pickupLatLng], {padding:[50,50]});
    // set active ride
    activeRide = {
      driver: drv,
      status: 'kutilmoqda', // kutilmoqda, qabul qildi, yo'lda, yetib keldi, boshladi, yakunlandi
      etaToPickupMin: Math.max(2, Math.round(haversine(driverLatLng,pickupLatLng)/0.6)), // assume 36 km/h ~0.6km/min
      etaToDropMin: null
    };
    statusEl.innerHTML = `Siz <strong>${drv.name}</strong> haydovchisini tanladingiz. Haydovchi yo'lga chiqmoqda. ETA: ${activeRide.etaToPickupMin} min.`;
  }

  // Map click handlers for selecting pickup/dropoff
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
    selecting = null;
    setPickupBtn.textContent = 'Xaritada pickup qo\'ying';
    setDropBtn.textContent = 'Xaritada dropoff qo\'ying';
  });

  setPickupBtn.addEventListener('click', () => {
    selecting = (selecting === 'pickup') ? null : 'pickup';
    setPickupBtn.textContent = selecting === 'pickup' ? 'Xaritada bosing (bekor qilish uchun yana bosing)' : 'Xaritada pickup qo\'ying';
  });
  setDropBtn.addEventListener('click', () => {
    selecting = (selecting === 'dropoff') ? null : 'dropoff';
    setDropBtn.textContent = selecting === 'dropoff' ? 'Xaritada bosing (bekor qilish uchun yana bosing)' : 'Xaritada dropoff qo\'ying';
  });

  // Показывать всех драйверов на карте и периодически слегка двигать их (симуляция)
  function jitterDrivers(){
    drivers.forEach(d=>{
      const jitter = (Math.random()-0.5) * 0.0015;
      d.lat += jitter; d.lng += jitter;
      const m = driverMarkers[d.id];
      if(m){ m.setLatLng([d.lat,d.lng]); }
    });
  }
  setInterval(jitterDrivers, 5000);

  // Request ride button
  requestBtn.addEventListener('click', () => {
    if(!pickupMarker || !dropMarker){ alert("Iltimos pickup va dropoff manzillarini tanlang."); return; }
    // Agar driver tanlanmagan, avtomatik eng yaqinini tanlaymiz
    if(!activeRide){
      // avtomatik tanlash
      const p = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
      const nearest = drivers.map(d=>({...d, dist:haversine(p,[d.lat,d.lng])})).sort((a,b)=>a.dist-b.dist)[0];
      selectDriver(nearest.id);
    }
    // Simulyatsiya: haydovchi 2-6 soniya ichida buyurtmani tasdiqlaydi
    statusEl.innerHTML = 'Buyurtma yuborildi. Haydovchiga yuborilmoqda...';
    setTimeout(()=>{
      if(!activeRide) return;
      activeRide.status = 'qabul qildi';
      statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> buyurtmani qabul qildi. Yo'lda: ${activeRide.etaToPickupMin} min.`;
      // Boshlanish: simulyatsiya qilib ETA kamaytirish
      let remaining = activeRide.etaToPickupMin;
      const tick = setInterval(()=>{
        remaining = Math.max(0, remaining-1);
        statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> yo'lda. Kelish: ${remaining} min.`;
        if(remaining <= 0){
          clearInterval(tick);
          activeRide.status = 'yetib keldi';
          statusEl.innerHTML = `Haydovchi <strong>${activeRide.driver.name}</strong> yetib keldi. Yozilgan manzilga chiqing.`;
          // End ride simulyatsiyasi: boshlab va tugatish
          setTimeout(()=>{
            activeRide.status = 'boshladi';
            statusEl.innerHTML = `Safar boshlandi. Iltimos xavfsiz joyda o'tiring.`;
            // Estimate drop time
            const p = [pickupMarker.getLatLng().lat, pickupMarker.getLatLng().lng];
            const d = [dropMarker.getLatLng().lat, dropMarker.getLatLng().lng];
            const km = haversine(p,d);
            const etaDrop = Math.max(3, Math.round(km/0.6));
            let rem2 = etaDrop;
            const tick2 = setInterval(()=>{
              rem2 = Math.max(0, rem2-1);
              statusEl.innerHTML = `Safar davom etmoqda. Yetib borish: ${rem2} min.`;
              if(rem2<=0){
                clearInterval(tick2);
                activeRide.status = 'yakunlandi';
                statusEl.innerHTML = `Safar tugadi. Rahmat!`;
                // tozalash: yo'lovchi markerlarini olib tashlash yoki saqlash
                activeRide = null;
                if(driverRouteLine){ map.removeLayer(driverRouteLine); driverRouteLine = null; }
              }
            }, 1000); // 1 second = 1 minute simulation
          }, 1500);
        }
      }, 1000); // 1 second = 1 minute simulation
    }, 2000);
  });

  // Allow manual lat/lng input (if user pastes coordinates)
  pickupInput.addEventListener('change', () => {
    const v = pickupInput.value.split(',').map(s=>s.trim());
    if(v.length===2 && !isNaN(Number(v[0]))){
      const lat = Number(v[0]), lng = Number(v[1]);
      if(pickupMarker) map.removeLayer(pickupMarker);
      pickupMarker = L.marker([lat,lng], {draggable:true}).addTo(map).bindPopup('Pickup').openPopup();
      map.setView([lat,lng], 13);
      renderDriversList(); updateEstimation();
    }
  });
  dropInput.addEventListener('change', () => {
    const v = dropInput.value.split(',').map(s=>s.trim());
    if(v.length===2 && !isNaN(Number(v[0]))){
      const lat = Number(v[0]), lng = Number(v[1]);
      if(dropMarker) map.removeLayer(dropMarker);
      dropMarker = L.marker([lat,lng], {draggable:true}).addTo(map).bindPopup('Dropoff').openPopup();
      map.setView([lat,lng], 13);
      updateEstimation();
    }
  });

  // Initial render
  renderDriversList();
  updateEstimation();

})();
