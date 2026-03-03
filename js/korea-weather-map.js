// js/korea-weather-map.js
// Leaflet 실제 지도: 날씨 그림(아이콘) + 온도 + 도시명 표시 (고급 divIcon)

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

function levelColor(level){
  if(level === "danger") return "#ef4444";
  if(level === "caution-status") return "#f59e0b";
  return "#12b76a";
}

function owmIconUrl(iconCode){
  const code = iconCode || "01d";
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

// ✅ 마커 CSS를 JS에서 주입(대표님 style.css에 추가 안 해도 동작)
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
    .dj-wxmk-icon{
      width:46px;height:46px;
      margin-top:-6px;
      image-rendering:auto;
    }
    .dj-wxmk-temp{
      font-weight:900;font-size:16px;line-height:1;margin-top:-4px;color:#111;
    }
    .dj-wxmk-name{
      font-weight:900;font-size:12px;line-height:1;margin-top:6px;color:#1e3932;
    }
    .dj-wxmk:hover{ filter: brightness(1.02); }
    .leaflet-popup-content{ margin:12px 14px; }
  `;
  document.head.appendChild(s);
}

// 기존 마커 제거
function clearMarkers(){
  for(const m of markers){
    try{ mapInstance.removeLayer(m); }catch(_){}
  }
  markers = [];
}

async function initRealKoreaMap(){
  ensureMarkerStyle();

  // 지도 재생성(새로고침 버튼 대응)
  if(mapInstance){
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map("koreaMapReal", { zoomControl:true }).setView([36.5, 127.8], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(mapInstance);

  clearMarkers();

  // 병렬 로딩
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

    // 날씨 못가져오면 기본값
    const temp = w?.current?.temp ?? 0;
    const desc = w?.current?.desc ?? "정보 없음";
    const iconCode = w?.current?.icon || "01d";
    const wind = w?.current?.wind ?? "-";
    const humidity = w?.current?.humidity ?? "-";
    const level = w?.decision?.level || "caution-status";
    const border = levelColor(level);

    const iconUrl = owmIconUrl(iconCode);

    // ✅ 핵심: divIcon으로 “그림+온도+도시” 표시
    const html = `
      <div class="dj-wxmk" style="border-color:${border}">
        <img class="dj-wxmk-icon" src="${iconUrl}"
             onerror="this.onerror=null;this.src='https://openweathermap.org/img/wn/01d@2x.png';" />
        <div class="dj-wxmk-temp">${Math.round(temp)}°</div>
        <div class="dj-wxmk-name">${c.name}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: "",
      html,
      iconSize: [86, 86],
      iconAnchor: [43, 86],   // 아래쪽 기준으로 찍히게
      popupAnchor: [0, -86]
    });

    const marker = L.marker([c.lat, c.lon], { icon }).addTo(mapInstance);

    const statusText = w?.decision?.statusText || "● 확인 필요";
    const mainMsg = w?.decision?.mainMsg || "날씨 정보를 확인 중입니다.";

    marker.bindPopup(`
      <div style="font-family:'Noto Sans KR';font-size:14px;">
        <b>${c.name}</b><br><br>
        🌡 ${temp}°C · ☁ ${desc}<br>
        💨 ${wind} m/s · 💧 ${humidity}%<br><br>
        <b>${statusText}</b><br>
        ${mainMsg}<br><br>
        📣 ${alert || "특보 없음"}
      </div>
    `);

    markers.push(marker);
  }
}

// 전역 등록 (index.html의 버튼/초기호출에서 사용)
window.initRealKoreaMap = initRealKoreaMap;