// js/weather.js
// 현재날씨 + 예보(12h 요약) + 대기질(PM2.5) + 작업판단 + iconCode 반환

const OWM_API_KEY = "97c0b999cc307cf079c6106404536f9e";

const __WX_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;

function __cacheGet(key){
  const v = __WX_CACHE.get(key);
  if(!v) return null;
  if(Date.now() - v.ts > CACHE_TTL_MS) return null;
  return v.data;
}
function __cacheSet(key, data){
  __WX_CACHE.set(key, { ts: Date.now(), data });
}

function summarizeNext12h(forecast){
  const list = forecast?.list || [];
  const next = list.slice(0, 4);
  let maxWind = 0, maxRain = 0, maxSnow = 0, popMax = 0;
  for(const it of next){
    maxWind = Math.max(maxWind, it?.wind?.speed ?? 0);
    maxRain = Math.max(maxRain, it?.rain?.["3h"] ?? 0);
    maxSnow = Math.max(maxSnow, it?.snow?.["3h"] ?? 0);
    popMax  = Math.max(popMax,  it?.pop ?? 0);
  }
  return { maxWind, maxRain, maxSnow, popMax };
}

function decideWorkMessage({temp, wind, rain1h, snow1h, pm25, next12}){
  let level = "normal";
  let statusText = "● 작업 가능";
  let mainMsg = "오늘은 작업해도 좋은 날씨입니다.";
  let extra = [];

  if(wind >= 14 || next12.maxWind >= 14){
    level = "danger";
    statusText = "● 작업 중지";
    mainMsg = "강풍(태풍급) 우려. 크레인·양중·고소작업 중지 및 자재 결속/천막 고정 점검 바랍니다.";
  } else if(wind >= 8 || next12.maxWind >= 8){
    level = "caution-status";
    statusText = "● 부분 통제";
    mainMsg = "바람이 많이 부니 자재 적재 및 천막/가설물 관리가 필요합니다.";
    extra.push("비산물 방지망·안전난간·비계 결속 상태 점검");
  }

  const heavyRainNow  = rain1h >= 5;
  const heavyRainSoon = next12.maxRain >= 10 || next12.popMax >= 0.7;
  if(heavyRainNow || heavyRainSoon){
    if(level !== "danger"){ level = "caution-status"; statusText = "● 부분 통제"; }
    mainMsg = "비가 많은 관계로 양수기 및 배수로 점검 바랍니다.";
    extra.push("누전차단기·전선 접속부 방수/절연 점검");
    extra.push("굴착부·흙막이·절토면 배수 정비");
  }

  if(snow1h >= 3 || next12.maxSnow >= 5){
    level = "danger";
    statusText = "● 작업 중지";
    mainMsg = "폭설/적설 우려. 제설 및 결빙 방지 후 작업, 고소·이동 작업은 중지 권고.";
  }

  if(temp >= 33){
    if(level !== "danger"){ level = "caution-status"; statusText = "● 부분 통제"; }
    mainMsg = "폭염 주의. 1시간 작업 후 10분 휴식, 수분·염분 보급 및 그늘 휴식 필수.";
    extra.push("옥외 작업자 열스트레스 관리");
  }
  if(temp <= -10){
    if(level !== "danger"){ level = "caution-status"; statusText = "● 부분 통제"; }
    mainMsg = "한파로 동결 위험. 타설·양생·수배관 동파 및 미끄럼 사고 주의 바랍니다.";
    extra.push("작업로 제설/염화칼슘, 결빙구간 표지");
  }

  if(typeof pm25 === "number" && pm25 >= 75){
    if(level !== "danger"){ level = "caution-status"; statusText = "● 부분 통제"; }
    extra.push("미세먼지 높음: 절단/연마 등 분진 작업 시 방진마스크·살수 강화");
  }

  return { level, statusText, mainMsg, extra };
}

async function loadSiteWeatherAndMent(lat, lon){
  const cacheKey = `wx:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = __cacheGet(cacheKey);
  if(cached) return cached;

  const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=kr`;
  const fcUrl  = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=kr`;
  const aqUrl  = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`;

  const [curRes, fcRes, aqRes] = await Promise.all([fetch(curUrl), fetch(fcUrl), fetch(aqUrl)]);
  const [cur, fc, aq] = await Promise.all([curRes.json(), fcRes.json(), aqRes.json().catch(()=>null)]);

  const temp     = cur?.main?.temp ?? 0;
  const wind     = cur?.wind?.speed ?? 0;
  const humidity = cur?.main?.humidity ?? 0;
  const desc     = cur?.weather?.[0]?.description ?? "-";
  const icon     = cur?.weather?.[0]?.icon || "01d";
  const rain1h   = cur?.rain?.["1h"] ?? 0;
  const snow1h   = cur?.snow?.["1h"] ?? 0;
  const pm25     = aq?.list?.[0]?.components?.pm2_5;
  const pm10     = aq?.list?.[0]?.components?.pm10;

  const next12   = summarizeNext12h(fc);
  const decision = decideWorkMessage({ temp, wind, rain1h, snow1h, pm25, next12 });

  const result = {
    current: { temp, wind, humidity, desc, icon, rain1h, snow1h, pm25, pm10 },
    next12,
    decision
  };

  __cacheSet(cacheKey, result);
  return result;
}

window.loadSiteWeatherAndMent = loadSiteWeatherAndMent;
