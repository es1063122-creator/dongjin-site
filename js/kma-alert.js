// js/kma-alert.js
// ✅ 공공데이터포털(data.go.kr) 기상청_기상특보 조회서비스 서비스키
// ⚠️ URL 인코딩된 serviceKey를 넣으세요(일반적으로 발급 키는 이미 인코딩 형태로 제공됨).
const KMA_SERVICE_KEY = "d3153c6bbc3d8f31d48919bbb714713a66af60facfd107eb0b3ff8aa0587a6ce";

function ymdhm(date){
  const pad = (n)=> String(n).padStart(2,"0");
  return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

async function fetchKmaAlertSummary(stnId){

  // 키 없으면 그냥 특보 없음 처리
  if(!KMA_SERVICE_KEY || KMA_SERVICE_KEY.includes("여기에")){
    return { text:"특보 없음" };
  }

  try{
    const now = new Date();
    const from = new Date(now.getTime() - 48*60*60*1000);

    const url =
      `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList` +
      `?serviceKey=${KMA_SERVICE_KEY}` +
      `&pageNo=1&numOfRows=5&dataType=JSON` +
      `&stnId=${encodeURIComponent(stnId)}` +
      `&fromTmFc=${encodeURIComponent(ymdhm(from))}` +
      `&toTmFc=${encodeURIComponent(ymdhm(now))}`;

    const res = await fetch(url);
    const json = await res.json();

    const items = json?.response?.body?.items?.item;

    // 데이터 없으면
    if(!items || (Array.isArray(items) && items.length === 0)){
      return { text:"특보 없음" };
    }

    const arr = Array.isArray(items) ? items : [items];

    if(arr.length === 0){
      return { text:"특보 없음" };
    }

    // 최신 특보 제목
    const latest = arr[0];
    const title = latest?.title || latest?.wrn || null;

    if(!title){
      return { text:"특보 없음" };
    }

    return { text:title };

  }catch(e){
    // 에러나도 특보 없음으로 처리
    return { text:"특보 없음" };
  }
}