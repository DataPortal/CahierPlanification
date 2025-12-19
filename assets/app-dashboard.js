(async function () {
  // -------------------------
  // Helpers (robustes)
  // -------------------------
  const $ = (id) => document.getElementById(id);

  function safeStr(v) {
    return (v === null || v === undefined) ? "" : String(v);
  }

  function toYearMonth(d) {
    const s = safeStr(d).trim();
    if (!s) return "Sans date";
    // accepte "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..."
    if (s.length >= 7 && s[4] === "-" && s[7] !== undefined) return s.slice(0, 7);
    return "Sans date";
  }

  function toNumber(v) {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const s = safeStr(v).trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }

  function groupCount(arr, fnKey) {
    return arr.reduce((acc, item) => {
      const k = fnKey(item);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  function sortObjByValueDesc(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }

  function limitCategories(entries, max = 12) {
    // Si trop de catégories, regrouper en "Autres"
    if (entries.length <= max) return entries;

    const head = entries.slice(0, max - 1);
    const tail = entries.slice(max - 1);
    const otherSum = tail.reduce((sum, [, v]) => sum + v, 0);
    head.push(["Autres", otherSum]);
    return head;
  }

  // -------------------------
  // Load data
  // -------------------------
  let data;
  try {
    data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(data)) throw new Error("activities.json is not an array");
  } catch (err) {
    console.error("Dashboard load error:", err);
    // fallback UI minimal
    const msg = document.createElement("div");
    msg.className = "card";
    msg.innerHTML = `
      <h2>Erreur de chargement</h2>
      <p class="muted">Impossible de charger <code>data/activities.json</code>. Vérifiez que le workflow a bien publié le fichier.</p>
    `;
    document.querySelector("main.container")?.prepend(msg);
    return;
  }

  // -------------------------
  // KPIs
  // -------------------------
  const total = data.length;
  const overdue = data.filter(d => d.overdue === 1).length;
  const withFollowup = data.filter(d => safeStr(d.commentaire_suivi).trim().length > 0).length;

  const avVals = data
    .map(d => toNumber(d.avancement_pct))
    .filter(v => typeof v === "number" && !Number.isNaN(v));

  const avg = avVals.length ? (avVals.reduce((a, b) => a + b, 0) / avVals.length) : null;

  $("kpi_total").textContent = String(total);
  $("kpi_overdue").textContent = String(overdue);
  $("kpi_with_followup").textContent = String(withFollowup);
  $("kpi_avg").textContent = avg === null ? "—" : `${Math.round(avg)}%`;

  // -------------------------
  // Charts defaults (modern, sans couleurs imposées)
  // -------------------------
  if (window.Chart) {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.mode = "index";
    Chart.defaults.plugins.tooltip.intersect = false;

    Chart.defaults.scales.category.ticks.autoSkip = true;
    Chart.defaults.scales.category.grid.display = false;

    Chart.defaults.scales.linear.beginAtZero = true;
    Chart.defaults.scales.linear.ticks.precision = 0;
  }

  // -------------------------
  // Groupings
  // -------------------------
  const byPilier = groupCount(data, d => safeStr(d.pilier).trim() || "Non renseigné");
  const byBureau = groupCount(data, d => safeStr(d.bureau).trim() || "Non renseigné");
  const byType = groupCount(data, d => safeStr(d.type_activite).trim() || "Non renseigné");
  const byStatutPlanif = groupCount(data, d => safeStr(d.statut_planificateur).trim() || "Non renseigné");
  const byMonthStart = groupCount(data, d => toYearMonth(d.date_debut));

  // -------------------------
  // Render charts (tri + limite catégories)
  // -------------------------
  const charts = [];

  function destroyAll() {
    charts.forEach(c => c.destroy());
    charts.length = 0;
  }

  function makeBar(canvasId, obj, maxCats = 12) {
    const entries = limitCategories(sortObjByValueDesc(obj), maxCats);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    const ctx = $(canvasId);
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Nombre", data: values }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0 } },
          y: { ticks: { precision: 0 } }
        }
      }
    });

    charts.push(chart);
  }

  function makeLine(canvasId, obj) {
    const labels = Object.keys(obj).sort(); // YYYY-MM
    const values = labels.map(k => obj[k]);

    const ctx = $(canvasId);
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Activités", data: values, tension: 0.25, pointRadius: 2 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0 } },
          y: { ticks: { precision: 0 } }
        }
      }
    });

    charts.push(chart);
  }

  destroyAll();
  makeBar("byPilier", byPilier, 10);
  makeBar("byBureau", byBureau, 12);
  makeBar("byType", byType, 12);
  makeBar("byStatutPlanif", byStatutPlanif, 10);
  makeLine("trendStart", byMonthStart);

})();
