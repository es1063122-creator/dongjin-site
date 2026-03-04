// js/kma-alert.js
// 기상청 기상특보 API 연동 (공공데이터포털)

const KMA_SERVICE_KEY = "d3153c6bbc3d8f31d48919bbb714713a66af60facfd107eb0b3ff8aa0587a6ce";

const __ALERT_CACHE = new Map();
const ALERT_TTL_MS = 5 * 60 * 1000; // 5분 캐시

// 기상청 지점코드 → 지역명 매핑
const STN_REGION = {
  108: "서울",
  133: "충청",
  143: "대구",
  152: "울산",
  156: "광주",
  159: "부산",
  184: "제주"
};

async function fetchKmaAlertSummary(stnId){
  const cacheKey = `kma:${stnId}`;
  const cached = __ALERT_CACHE.get(cacheKey);
  if(cached && Date.now() - cached.ts < ALERT_TTL_MS) return cached.data;

  try {
    const url =
      `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList` +
      `?serviceKey=${KMA_SERVICE_KEY}` +
      `&pageNo=1&numOfRows=20&dataType=JSON`;

    const res = await fetch(url);

    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const items = json?.response?.body?.items?.item || [];

    // 배열이 아닌 경우(단건) 배열로 통일
    const list = Array.isArray(items) ? items : [items];

    // 해당 지역 특보 필터
    const regionName = STN_REGION[stnId] || "";
    const active = list.filter(it => {
      const isActive = it.cmdcd === "발표" || it.cmdcd === "갱신";
      const matchRegion = !regionName || (it.areaName || "").includes(regionName);
      return isActive && matchRegion;
    });

    let text = "특보 없음";
    let level = "none";

    if(active.length > 0){
      const names = [...new Set(active.map(it => it.wrnName || "특보"))];
      text = names.join(", ") + " 발효 중";
      level = "active";
    }

    const result = { text, level, raw: active };
    __ALERT_CACHE.set(cacheKey, { ts: Date.now(), data: result });
    return result;

  } catch(e) {
    console.warn("기상청 특보 API 오류:", e.message);
    const result = { text: "특보 없음", level: "none" };
    __ALERT_CACHE.set(cacheKey, { ts: Date.now(), data: result });
    return result;
  }
}

window.fetchKmaAlertSummary = fetchKmaAlertSummary;
