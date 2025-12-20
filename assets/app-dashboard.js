(async function () {
  // =============================
  // 1) Charger les données
  // =============================
  let raw;
  try {
    raw = await fetch("./data/activities.json", { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(raw)) throw new Error("activities.json is not an array");
  } catch (e) {
    console.error("Failed to load activities.json", e);
    return;
  }

  const data = raw;

  // =============================
  // 2) Utils
  // =============================
  const toYM = (d) => (d && String(d).length >= 7) ? String(d).slice(0, 7) : "Sans date";

  const numOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const avg = (arr) => {
    const vals = arr.map(numOrNull).filter(v => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const groupCount = (arr, keyFn) => {
    return arr.reduce((acc, it) => {
      const k = keyFn(it);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  };

  const isOverdue = (r) => r && r.overdue === 1;

  // Risque score (pour “Top à risque”)
  const riskScore = (r) => {
    const risk = (r?.risque_priorite || "").toString().toLowerCase();
    let score = 0;

    if (isOverdue(r)) score += 100;

    if (risk.includes("crit")) score += 80;
    else if (risk.includes("élev") || risk.includes("ele") || risk.includes("haut")) score += 60;
    else if (risk.includes("moy")) score += 40;
    else if (risk.includes("faib")) score += 20;

    // Si fin imminente (<= 7 jours) et pas finalisée : +20
    try {
      const fin = r?.date_fin ? new Date(r.date_fin) : null;
      const today = new Date(); today.setHours(0,0,0,0);
      if (fin && !Number.isNaN(fin.getTime())) {
        const diffDays = Math.round((fin.getTime() - today.getTime()) / (1000*60*60*24));
        const st = ((r?.statut_planificateur || "") + " " + (r?.statut_suivi || "")).toLowerCase();
        const done = ["final", "clôt", "clot", "termin", "achev", "done", "completed", "annul"].some(x => st.includes(x));
        if (!done && diffDays >= 0 && diffDays <= 7) score += 20;
      }
    } catch (_) {}

    return score;
  };

  // =============================
  // 3) KPIs
  // =============================
  const total = data.length;
  const overdue = data.filter(isOverdue).length;
  const withFollowup = data.filter(d => (d.commentaire_suivi || "").toString().trim().length > 0).length;

  const avgPct = avg(data.map(d => d.avancement_pct));
  // (optionnel) moyenne du taux calculé, si vous voulez l’utiliser plus tard
  // const avgCalc = avg(data.map(d => d.taux_avancement_calc));

  const elTotal = document.getElementById("kpi_total");
  const elOverdue = document.getElementById("kpi_overdue");
  const elWith = document.getElementById("kpi_with_followup");
  const elAvg = document.getElementById("kpi_avg");

  if (elTotal) elTotal.textContent = total;
  if (elOverdue) elOverdue.textContent = overdue;
  if (elWith) elWith.textContent = withFollowup;
  if (elAvg) elAvg.textContent = (avgPct === null) ? "—" : `${Math.round(avgPct)}%`;

  // =============================
  // 4) Charts
  // =============================
  const byPilier = groupCount(data, d => d.pilier || "Non renseigné");
  const byBureau = groupCount(data, d => d.bureau || "Non renseigné");
  const byType = groupCount(data, d => d.type_activite || "Non renseigné");
  const byStatutPlanif = groupCount(data, d => d.statut_planificateur || "Non renseigné");
  const trendStart = groupCount(data, d => toYM(d.date_debut));

  function makeBar(canvasId, obj, label) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const labels = Object.keys(obj);
    new Chart(el, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: label || "Nombre", data: labels.map(k => obj[k]) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { autoSkip: false } } }
      }
    });
  }

  function makeLine(canvasId, obj, label) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const labels = Object.keys(obj).sort();
    new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: label || "Activités", data: labels.map(k => obj[k]) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  makeBar("byPilier", byPilier, "Activités");
  makeBar("byBureau", byBureau, "Activités");
  makeBar("byType", byType, "Activités");
  makeBar("byStatutPlanif", byStatutPlanif, "Activités");
  makeLine("trendStart", trendStart, "Activités");

  // =============================
  // 5) Top activités à risque (riskTbl)
  // =============================
  const riskTbody = document.querySelector("#riskTbl tbody");
  if (riskTbody) {
    const top = data
      .slice()
      .sort((a, b) => riskScore(b) - riskScore(a))
      .slice(0, 12);

    const esc = (v) =>
      (v == null ? "" : String(v))
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    riskTbody.innerHTML = top.map(r => {
      const pct = numOrNull(r.avancement_pct);
      const pctStr = (pct === null) ? "—" : `${Math.round(Math.max(0, Math.min(100, pct)))}%`;

      return `
        <tr>
          <td class="col-code">${esc(r.code_activite || "")}</td>
          <td class="col-title">${esc(r.titre || "")}</td>
          <td>${esc(r.bureau || "")}</td>
          <td>${esc(r.pilier || "")}</td>
          <td>${esc(r.risque_priorite || (isOverdue(r) ? "En retard" : ""))}</td>
          <td>${esc(r.date_debut || "")}</td>
          <td>${esc(r.date_fin || "")}</td>
          <td>${esc(r.statut_planificateur || "")}</td>
          <td>${esc(pctStr)}</td>
        </tr>
      `;
    }).join("");
  }
})();
