(async function () {
  const data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => r.json());

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
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Nombre", data: labels.map(k => obj[k]) }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function makeLine(canvasId, obj) {
    const labels = Object.keys(obj).sort();
    const ctx = document.getElementById(canvasId);
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Activités", data: labels.map(k => obj[k]) }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
})();
