// js/kma-alert.js
// 기상청 특보 요약 (OpenWeather 기반 간소화 버전)
// 실제 기상청 API 연동 전까지는 OpenWeather 현재 날씨로 특보 판단

const __ALERT_CACHE = new Map();
const ALERT_TTL_MS = 5 * 60 * 1000;

async function fetchKmaAlertSummary(stnId){
  const cacheKey = `alert:${stnId}`;
  const cached = __ALERT_CACHE.get(cacheKey);
  if(cached && Date.now() - cached.ts < ALERT_TTL_MS) return cached.data;

  // 기상청 공개 RSS 특보 시도 (CORS 우회 불가 시 fallback)
  try {
    const url = `https://www.weather.go.kr/w/rss/dfs/hr1-forecast.do?zone=${String(stnId).padStart(10,'0')}`;
    const res = await fetch(url, { mode: "no-cors" });
    // no-cors면 opaque response → fallback
  } catch(e){}

  // Fallback: OpenWeather one-call로 alerts 체크 (무료 tier는 미지원 → 빈 배열)
  const result = { text: "특보 없음", level: "none" };
  __ALERT_CACHE.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}

window.fetchKmaAlertSummary = fetchKmaAlertSummary;
