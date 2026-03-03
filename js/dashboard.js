// js/dashboard.js
(async function(){
  const grid = document.getElementById("dashGrid");
  grid.innerHTML = "";

  const entries = Object.entries(sites);

  for(const [key, site] of entries){
    const card = document.createElement("a");
    card.className = "card";
    card.href = `site.html?site=${encodeURIComponent(key)}`;
    card.innerHTML = `
      <div class="badge">${(site.address||"").split(" ")[0] || "현장"}</div>
      <h2>${site.name}</h2>
      <p class="muted">${site.address || ""}</p>
      <div class="mini" id="mini-${key}">불러오는 중...</div>
    `;
    grid.appendChild(card);

    // 비동기 로딩
    (async ()=>{
      try{
        const w = await loadSiteWeatherAndMent(site.lat, site.lon);
        const a = await fetchKmaAlertSummary(site.stnId);

        const mini = document.getElementById(`mini-${key}`);
        mini.innerHTML = `
          <b>${w.decision.statusText}</b><br>
          ${w.decision.mainMsg}<br>
          📣 ${a.text}
        `;

        // 카드 테두리 느낌으로 상태 강조
        if(w.decision.level === "danger") card.style.outline = "3px solid rgba(239,68,68,.35)";
        else if(w.decision.level === "caution-status") card.style.outline = "3px solid rgba(245,158,11,.35)";
        else card.style.outline = "3px solid rgba(18,183,106,.25)";
        card.style.outlineOffset = "2px";
      }catch(e){
        const mini = document.getElementById(`mini-${key}`);
        mini.textContent = "데이터 로딩 실패";
      }
    })();
  }
})();