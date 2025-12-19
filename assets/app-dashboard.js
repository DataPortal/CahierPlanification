(async function () {
  const data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => r.json());

  // KPIs (adaptez les libellés de statut selon votre Kobo)
  const total = data.length;
  const planned = data.filter(d => norm(d.statut).includes("plan")).length;
  const ongoing = data.filter(d => norm(d.statut).includes("cours") || norm(d.statut).includes("ongo")).length;
  const done = data.filter(d => norm(d.statut).includes("clot") || norm(d.statut).includes("term") || norm(d.statut).includes("done")).length;

  document.getElementById("kpi_total").textContent = total;
  document.getElementById("kpi_planned").textContent = planned;
  document.getElementById("kpi_ongoing").textContent = ongoing;
  document.getElementById("kpi_done").textContent = done;

  // Groupings
  const byPilier = groupCount(data, d => d.pilier || "Non renseigné");
  const byStatus = groupCount(data, d => d.statut || "Non renseigné");
  const byMonth = groupCount(data, d => (d.date_debut || "").slice(0,7) || "Sans date");

  // Charts
  makeBar("byPilier", byPilier);
  makeBar("byStatus", byStatus);
  makeLine("trend", byMonth);

  function makeBar(canvasId, obj) {
    const ctx = document.getElementById(canvasId);
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(obj),
        datasets: [{ label: "Nombre", data: Object.values(obj) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  function makeLine(canvasId, obj) {
    // tri mois
    const labels = Object.keys(obj).sort();
    const ctx = document.getElementById(canvasId);
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Activités", data: labels.map(k => obj[k]) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
})();
