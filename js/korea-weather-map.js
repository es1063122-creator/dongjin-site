// js/korea-weather-map.js
// Leaflet 실제 지도 + 고급 커스텀 마커(아이콘+온도+도시명)

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
let __markers = [];

function levelColor(level){
  if(level === "danger") return "#ef4444";          // 중지
  if(level === "caution-status") return "#f59e0b";  // 부분통제
  return "#12b76a";                                 // 가능
}

function iconUrlFromCode(iconCode){
  const code = iconCode || "01d";
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

// ✅ 커스텀 마커 HTML (아이콘+온도+도시명)
function makeMarkerHTML({name, temp, iconCode, level}){
  const border = levelColor(level);
  const iconUrl = iconUrlFromCode(iconCode);

  // img 에러 시 fallback(01d)
  return `
    <div class="wxmk" style="border-color:${border}">
      <img class="wxmk-icon" src="${iconUrl}"
           onerror="this.onerror=null;this.src='https://openweathermap.org/img/wn/01d@2x.png';" />
      <div class="wxmk-temp">${Math.round(temp)}°</div>
      <div class="wxmk-name">${name}</div>
    </div>
  `;
}

function ensureMarkerCSS(){
  if(document.getElementById("wxmk-style")) return;
  const s = document.createElement("style");
  s.id = "wxmk-style";
  s.textContent = `
    .wxmk{
      width:76px;height:76px;border-radius:18px;
      background:rgba(255,255,255,.95);
      border:3px solid #12b76a;
      box-shadow:0 14px 30px rgba(0,0,0,.18);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      transform: translateY(-6px);
      backdrop-filter: blur(8px);
    }
    .wxmk-icon{width:42px;height:42px;display:block;margin-top:-4px;}
    .wxmk-temp{font-weight:900;font-size:16px;line-height:1;margin-top:-2px;color:#111;}
    .wxmk-name{font-weight:900;font-size:12px;line-height:1;margin-top:4px;color:#1e3932;}
    .leaflet-popup-content{margin:12px 14px;}
    .wxpop h3{margin:0 0 8px;font-size:16px;font-weight:900;}
    .wxpop .muted{color:#666;font-size:12px;margin-top:6px;}
    .wxpop .pill{
      display:inline-flex;align-items:center;gap:6px;
      padding:6px 10px;border-radius:999px;
      font-weight:900;font-size:12px;color:#fff;margin:8px 0 10px;
    }
  `;
  document.head.appendChild(s);
}

function clearMarkers(){
  for(const m of __markers){
    try{ mapInstance.removeLayer(m); }catch(_){}
  }
  __markers = [];
}

async function initRealKoreaMap(){
  ensureMarkerCSS();

  // 지도 초기화
  if(mapInstance){
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map("koreaMapReal", { zoomControl:true }).setView([36.5, 127.8], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(mapInstance);

  clearMarkers();

  // 도시들을 병렬로 로딩(속도 개선)
  const results = await Promise.all(
    KOREA_CITIES.map(async (c)=> {
      try{
        const w = await loadSiteWeatherAndMent(c.lat, c.lon);
        const a = await fetchKmaAlertSummary(c.stnId); // 특보없으면 내부에서 "특보 없음"
        return { c, w, alert: a?.text || "특보 없음" };
      }catch(e){
        return { c, w: null, alert: "특보 없음" };
      }
    })
  );

  // 마커 생성
  for(const r of results){
    const c = r.c;
    const w = r.w;

    if(!w){
      // 데이터 없을 때도 기본 마커 표시
      const html = makeMarkerHTML({name:c.name, temp:0, iconCode:"01d", level:"caution-status"});
      const icon = L.divIcon({ className:"", html, iconSize:[76,76], iconAnchor:[38,76] });
      const mk = L.marker([c.lat, c.lon], { icon }).addTo(mapInstance);
      mk.bindPopup(`<div class="wxpop"><h3>${c.name}</h3>날씨 로딩 실패</div>`);
      __markers.push(mk);
      continue;
    }

    const level = w.decision.level;
    const pillColor = levelColor(level);

    const html = makeMarkerHTML({
      name: c.name,
      temp: w.current.temp,
      iconCode: w.current.icon,
      level
    });

    const icon = L.divIcon({
      className: "",
      html,
      iconSize: [76, 76],
      iconAnchor: [38, 76]
    });

    const mk = L.marker([c.lat, c.lon], { icon }).addTo(mapInstance);

    mk.bindPopup(`
      <div class="wxpop">
        <h3>${c.name}</h3>
        <div class="pill" style="background:${pillColor}">${w.decision.statusText}</div>
        <div>🌡 ${w.current.temp}°C · ☁ ${w.current.desc}</div>
        <div>💨 ${w.current.wind} m/s · 💧 ${w.current.humidity}%</div>
        <div class="muted" style="margin-top:10px;font-weight:800;">${w.decision.mainMsg}</div>
        <div class="muted">📣 ${r.alert || "특보 없음"}</div>
      </div>
    `);

    __markers.push(mk);
  }
}

window.initRealKoreaMap = initRealKoreaMap;