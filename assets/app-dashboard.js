(async function () {
  let data;
  try {
    data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(data)) throw new Error("activities.json is not an array");
  } catch (e) {
    console.error("Failed to load activities.json", e);
    return;
  }

  // KPIs
  const total = data.length;
  const overdue = data.filter(d => d.overdue === 1).length;
  const withFollowup = data.filter(d => (d.commentaire_suivi || "").trim().length > 0).length;

  const avVals = data
    .map(d => d.avancement_pct)
    .filter(v => typeof v === "number" && !Number.isNaN(v));
  const avg = avVals.length ? (avVals.reduce((a,b)=>a+b,0) / avVals.length) : null;

  document.getElementById("kpi_total").textContent = total;
  document.getElementById("kpi_overdue").textContent = overdue;
  document.getElementById("kpi_with_followup").textContent = withFollowup;
  document.getElementById("kpi_avg").textContent = avg === null ? "—" : `${Math.round(avg)}%`;

  // Groupings
  const byPilier = groupCount(data, d => d.pilier || "Non renseigné");
  const byBureau = groupCount(data, d => d.bureau || "Non renseigné");
  const byType = groupCount(data, d => d.type_activite || "Non renseigné");
  const byStatutPlanif = groupCount(data, d => d.statut_planificateur || "Non renseigné");
  const byMonthStart = groupCount(data, d => (d.date_debut || "").slice(0,7) || "Sans date");

  makeBar("byPilier", byPilier);
  makeBar("byBureau", byBureau);
  makeBar("byType", byType);
  makeBar("byStatutPlanif", byStatutPlanif);
  makeLine("trendStart", byMonthStart);

  // Risk table
  renderRiskTable(data);

  function groupCount(arr, fnKey) {
    return arr.reduce((acc, item) => {
      const k = fnKey(item);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  function makeBar(canvasId, obj) {
    const labels = Object.keys(obj);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Nombre", data: labels.map(k => obj[k]) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  function makeLine(canvasId, obj) {
    const labels = Object.keys(obj).sort();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Activités", data: labels.map(k => obj[k]) }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function riskScore(p) {
    const s = (p || "").toString().toLowerCase();
    if (s.includes("criti")) return 4;
    if (s.includes("élev") || s.includes("eleve")) return 3;
    if (s.includes("moy")) return 2;
    if (s.includes("faib")) return 1;
    return 0;
  }

  function renderRiskTable(rows) {
    const tbl = document.getElementById("riskTbl");
    if (!tbl) return;
    const tbody = tbl.querySelector("tbody");
    if (!tbody) return;

    const sorted = rows.slice().sort((a, b) => {
      // Overdue d’abord
      if ((b.overdue||0) !== (a.overdue||0)) return (b.overdue||0) - (a.overdue||0);
      // Ensuite risque/priorité
      const ra = riskScore(a.risque_priorite);
      const rb = riskScore(b.risque_priorite);
      if (rb !== ra) return rb - ra;
      // Ensuite date_fin la plus proche
      return (a.date_fin || "9999-12-31").localeCompare(b.date_fin || "9999-12-31");
    });

    const top = sorted.slice(0, 10);

    tbody.innerHTML = top.map(r => {
      const pct = (typeof r.avancement_pct === "number" && !Number.isNaN(r.avancement_pct))
        ? Math.round(r.avancement_pct)
        : null;

      const status = r.statut_suivi || r.statut_planificateur || "";

      return `
        <tr>
          <td class="col-code">${escapeHtml(r.code_activite || "")}</td>
          <td class="col-title">
            ${escapeHtml(r.titre || "")}
            <span class="cell-sub">
              ${escapeHtml([r.bureau, r.pilier, r.type_activite, r.risque_priorite ? `Risque: ${r.risque_priorite}` : ""].filter(Boolean).join(" • "))}
            </span>
          </td>
          <td>${escapeHtml(r.date_debut || "")}</td>
          <td>${escapeHtml(r.date_fin || "")}</td>
          <td>${escapeHtml(status)}</td>
          <td class="col-pct">
            ${pct === null ? "—" : `${pct}%`}
          </td>
        </tr>
      `;
    }).join("");
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
