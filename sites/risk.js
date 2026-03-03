const riskData = {
  "ulsan-woojung": [
    "고소작업 추락 위험",
    "철근 적재물 낙하 위험",
    "타워크레인 충돌 위험",
    "전기배선 노출 감전 위험",
    "비계 해체 중 붕괴 위험"
  ]
};

function loadRisk(siteKey) {
  const list = document.getElementById("riskList");
  list.innerHTML = "";

  riskData[siteKey].forEach(risk => {
    const li = document.createElement("li");
    li.textContent = risk;
    list.appendChild(li);
  });
}