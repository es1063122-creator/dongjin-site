// js/korea-weather-map.js
// Leaflet 실제 지도 + 날씨 아이콘 마커 + 클릭 시 하단 예보패널(시간별/주간/그래프) 표시

const OWM_API_KEY_FOR_FORECAST = "97c0b999cc307cf079c6106404536f9e";

const KOREA_CITIES = [
  { name:"서울",   lat:37.5665, lon:126.9780, stnId:108 },
  { name:"인천",   lat:37.4563, lon:126.7052, stnId:108 },
  { name:"수원",   lat:37.2636, lon:127.0286, stnId:108 },
  { name:"대전",   lat:36.3504, lon:127.3845, stnId:133 },
  { name:"광주",   lat:35.1595, lon:126.8526, stnId:156 },
  { name:"대구",   lat:35.8714, lon:128.6014, stnId:143 },
  { name:"울산",   lat:35.5384, lon:129.3114, stnId:152 },
  { name:"부산",   lat:35.1796, lon:129.0756, stnId:159 },
  { name:"제주",   lat:33.4996, lon:126.5312, stnId:184 }
];

let mapInstance = null;
let markers = [];
let chartInstance = null;

function levelColor(level){
  if(level === "danger") return "#ef4444";
  if(level === "caution-status") return "#f59e0b";
  return "#12b76a";
}

function owmIconUrl(iconCode){
  const code = iconCode || "01d";
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

function ensureMarkerStyle(){
  if(document.getElementById("dj-wxmk-style")) return;
  const s = document.createElement("style");
  s.id = "dj-wxmk-style";
  s.textContent = `
    .dj-wxmk{
      width:86px;height:86px;border-radius:20px;
      background:rgba(255,255,255,.96);
      border:3px solid #12b76a;
      box-shadow:0 18px 38px rgba(0,0,0,.18);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      backdrop-filter: blur(10px);
      transform: translateY(-8px);
    }
    .dj-wxmk-icon{width:46px;height:46px;margin-top:-6px}
    .dj-wxmk-temp{font-weight:900;font-size:16px;line-height:1;margin-top:-4px;color:#111}
    .dj-wxmk-name{font-weight:900;font-size:12px;line-height:1;margin-top:6px;color:#1e3932}
    .leaflet-popup-content{ margin:12px 14px; }
  `;
  document.head.appendChild(s);
}

function clearMarkers(){
  for(const m of markers){
    try{ mapInstance.removeLayer(m); }catch(_){}
  }
  markers = [];
}

function setForecastHeader(name){
  const title = document.getElementById("forecastTitle");
  const sub   = document.getElementById("forecastSub");
  if(title) title.innerText = `${name} 날씨 관제`;
  if(sub)   sub.innerText = `시간별(24h) + 주간(5일) 예보`;
  const up = document.getElementById("forecastUpdated");
  if(up){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    up.innerText = `업데이트 ${hh}:${mm}`;
  }
}

function renderHourly(data){
  const box = document.getElementById("hourlyWeather");
  if(!box) return;
  box.innerHTML = "";

  const list = (data?.list || []).slice(0, 8); // 24시간
  for(const w of list){
    const dt = new Date(w.dt * 1000);
    const hh = String(dt.getHours()).padStart(2,"0");
    const label = `${hh}시`;
    const icon = `https://openweathermap.org/img/wn/${w.weather[0].icon}.png`;
    const temp = Math.round(w.main.temp);
    const pop = Math.round((w.pop ?? 0) * 100);

    const div = document.createElement("div");
    div.className = "hour-card";
    div.innerHTML = `
      <div style="font-weight:900">${label}</div>
      <img src="${icon}" alt="">
      <div style="font-weight:900">${temp}°</div>
      <div class="muted" style="font-size:12px">${pop}%</div>
    `;
    box.appendChild(div);
  }
}

function renderDaily(data){
  const box = document.getElementById("dailyWeather");
  if(!box) return;
  box.innerHTML = "";

  const days = {};
  for(const w of (data?.list || [])){
    const d = new Date(w.dt * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    if(!days[key]) days[key] = [];
    days[key].push(w);
  }

  const entries = Object.entries(days).slice(0, 5);

  for(const [_, arr] of entries){
    // 하루 중 정오 근처(12시) 값 선택(없으면 가운데)
    let pick = arr[Math.floor(arr.length/2)];
    let bestDiff = 999;
    for(const w of arr){
      const h = new Date(w.dt * 1000).getHours();
      const diff = Math.abs(h - 12);
      if(diff < bestDiff){ bestDiff = diff; pick = w; }
    }

    const dayName = new Date(pick.dt * 1000).toLocaleDateString("ko-KR",{weekday:"short"});
    const icon = `https://openweathermap.org/img/wn/${pick.weather[0].icon}.png`;
    const desc = pick.weather[0].description;
    const temp = Math.round(pick.main.temp);

    const row = document.createElement("div");
    row.className = "day-card";
    row.innerHTML = `
      <div class="day-left">
        <img src="${icon}" alt="">
        <div>
          <div class="day-name">${dayName}</div>
          <div class="day-desc">${desc}</div>
        </div>
      </div>
      <div class="day-temp">${temp}°</div>
    `;
    box.appendChild(row);
  }
}

function renderChart(data){
  const canvas = document.getElementById("weatherChart");
  if(!canvas) return;

  const list = (data?.list || []).slice(0, 8);
  const labels = list.map(w=>{
    const h = String(new Date(w.dt*1000).getHours()).padStart(2,"0");
    return `${h}시`;
  });
  const temps = list.map(w=> w.main.temp);

  if(chartInstance){
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "기온(°C)",
        data: temps,
        tension: 0.35
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v)=> `${v}°` } }
      }
    }
  });
}

function setBriefBox(weather, alertText){
  const status = document.getElementById("briefStatus");
  const ment   = document.getElementById("briefMent");
  const alert  = document.getElementById("briefAlert");

  const level = weather?.decision?.level || "normal";
  const color = levelColor(level);

  if(status){
    status.style.background = color;
    status.innerText = weather?.decision?.statusText || "● 확인 필요";
  }
  if(ment){
    ment.innerText = weather?.decision?.mainMsg || "날씨 정보를 확인 중입니다.";
    ment.classList.remove("muted");
  }
  if(alert){
    alert.innerText = `📣 특보: ${alertText || "특보 없음"}`;
    alert.classList.remove("muted");
  }
}

async function loadForecastAndRender(lat, lon, name, stnId){
  setForecastHeader(name);

  // 1) 상세예보(5일/3시간) = 시간별/주간/그래프에 사용
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY_FOR_FORECAST}&units=metric&lang=kr`;
  const res = await fetch(url);
  const data = await res.json();

  renderHourly(data);
  renderDaily(data);
  renderChart(data);

  // 2) 작업판단(현재날씨 기반)
  const weather = await loadSiteWeatherAndMent(lat, lon);

  // 3) 특보
  const a = await fetchKmaAlertSummary(stnId);
  const alertText = a?.text || "특보 없음";

  setBriefBox(weather, alertText);

  // 패널로 스크롤(원하면)
  const panel = document.getElementById("forecastPanel");
  if(panel){
    panel.scrollIntoView({ behavior:"smooth", block:"start" });
  }
}

async function initRealKoreaMap(){
  ensureMarkerStyle();

  if(mapInstance){
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map("koreaMapReal", { zoomControl:true }).setView([36.5, 127.8], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(mapInstance);

  clearMarkers();

  const results = await Promise.all(
    KOREA_CITIES.map(async (c)=>{
      try{
        const w = await loadSiteWeatherAndMent(c.lat, c.lon);
        const a = await fetchKmaAlertSummary(c.stnId);
        return { c, w, alert: a?.text || "특보 없음" };
      }catch(e){
        return { c, w: null, alert: "특보 없음" };
      }
    })
  );

  for(const r of results){
    const { c, w, alert } = r;

    const temp = w?.current?.temp ?? 0;
    const desc = w?.current?.desc ?? "정보 없음";
    const iconCode = w?.current?.icon || "01d";
    const wind = w?.current?.wind ?? "-";
    const humidity = w?.current?.humidity ?? "-";

    const level = w?.decision?.level || "normal";
    const border = levelColor(level);

    const html = `
      <div class="dj-wxmk" style="border-color:${border}">
        <img class="dj-wxmk-icon" src="${owmIconUrl(iconCode)}"
             onerror="this.onerror=null;this.src='https://openweathermap.org/img/wn/01d@2x.png';" />
        <div class="dj-wxmk-temp">${Math.round(temp)}°</div>
        <div class="dj-wxmk-name">${c.name}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: "",
      html,
      iconSize: [86, 86],
      iconAnchor: [43, 86],
      popupAnchor: [0, -86]
    });

    const marker = L.marker([c.lat, c.lon], { icon }).addTo(mapInstance);

    const statusText = w?.decision?.statusText || "● 확인 필요";
    const mainMsg = w?.decision?.mainMsg || "날씨 정보를 확인 중입니다.";

    marker.bindPopup(`
      <div style="font-family:'Noto Sans KR';font-size:14px;">
        <b>${c.name}</b><br><br>
        🌡 ${Math.round(temp)}°C · ☁ ${desc}<br>
        💨 ${wind} m/s · 💧 ${humidity}%<br><br>
        <b>${statusText}</b><br>
        ${mainMsg}<br><br>
        📣 ${alert || "특보 없음"}<br>
        <span class="muted" style="font-size:12px;">(마커 클릭 시 하단 상세예보 표시)</span>
      </div>
    `);

    marker.on("click", ()=>{
      loadForecastAndRender(c.lat, c.lon, c.name, c.stnId);
    });

    markers.push(marker);
  }

  // 기본 선택(서울 자동 표시) - 원치 않으면 이 줄 삭제
  loadForecastAndRender(KOREA_CITIES[0].lat, KOREA_CITIES[0].lon, KOREA_CITIES[0].name, KOREA_CITIES[0].stnId);
}

window.initRealKoreaMap = initRealKoreaMap;