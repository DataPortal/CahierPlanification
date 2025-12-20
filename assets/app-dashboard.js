// assets/app-dashboard.js
(async function () {
  "use strict";

  // -------------------------
  // Load data
  // -------------------------
  let data;
  try {
    data = await fetch("./data/activities.json", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(data)) throw new Error("activities.json is not an array");
  } catch (e) {
    console.error("Failed to load activities.json", e);
    return;
  }

  const esc = window.escHTML || ((v) => (v == null ? "" : String(v)));

  const $ = (id) => document.getElementById(id);

  // KPIs
  const elTotal = $("kpi_total");
  const elOverdue = $("kpi_overdue");
  const elWithFollowup = $("kpi_with_followup");
  const elAvg = $("kpi_avg");

  // Charts
  const ctxPilier = $("byPilier");
  const ctxBureau = $("byBureau");
  const ctxType = $("byType");
  const ctxStatutPlanif = $("byStatutPlanif");
  const ctxTrend = $("trendStart");

  // Risk table
  const riskBody = document.querySelector("#riskTbl tbody");

  // -------------------------
  // Utils
  // -------------------------
  function isOverdue(r) {
    return r && r.overdue === 1;
  }

  function hasFollowup(r) {
    return !!(r && String(r.commentaire_suivi || "").trim());
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function groupCount(rows, keyFn) {
    const m = new Map();
    rows.forEach((r) => {
      const k = keyFn(r) || "Non renseigné";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }

  // ---- Trend weekly (ISO week) ----
  function isoWeekKey(isoDate) {
    if (!isoDate) return null;

    // Parse "YYYY-MM-DD" safely in local time
    const parts = String(isoDate).slice(0, 10).split("-");
    if (parts.length !== 3) return null;

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    // UTC date for ISO week math
    const date = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(date.getTime())) return null;

    // ISO week algorithm
    // Thursday in current week decides the year
    const day = date.getUTCDay() || 7; // Mon=1..Sun=7
    date.setUTCDate(date.getUTCDate() + 4 - day);

    const isoYear = date.getUTCFullYear();

    // Week 1 is the week with Jan 4th
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

    const ww = String(weekNo).padStart(2, "0");
    return `${isoYear}-W${ww}`;
  }

  // priorité risque pour tri
  function priorityRank(p) {
    const t = String(p || "").toLowerCase();
    if (t.includes("criti")) return 4;
    if (t.includes("élev") || t.includes("eleve")) return 3;
    if (t.includes("moy")) return 2;
    if (t.includes("faib")) return 1;
    return 0;
  }

  // -------------------------
  // KPIs (inchangé)
  // -------------------------
  const total = data.length;
  const overdue = data.filter(isOverdue).length;
  const withFollowup = data.filter(hasFollowup).length;

  const pctValues = data
    .map((r) => num(r.avancement_pct))
    .filter((x) => x !== null);

  const avg = pctValues.length ? Math.round(pctValues.reduce((a, b) => a + b, 0) / pctValues.length) : null;

  if (elTotal) elTotal.textContent = String(total);
  if (elOverdue) elOverdue.textContent = String(overdue);
  if (elWithFollowup) elWithFollowup.textContent = String(withFollowup);
  if (elAvg) elAvg.textContent = avg === null ? "—" : `${avg}%`;

  // -------------------------
  // Charts (Chart.js)
  // -------------------------
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded");
    return;
  }

  Chart.defaults.font.family = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
  Chart.defaults.plugins.legend.display = false;

  function makeBarChart(canvas, pairs, label) {
    if (!canvas) return null;
    const labels = pairs.map((x) => x[0]);
    const values = pairs.map((x) => x[1]);
    return new Chart(canvas, {
      type: "bar",
      data: { labels, datasets: [{ label, data: values }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxRotation: 30, minRotation: 0 } },
          y: { beginAtZero: true, precision: 0 }
        }
      }
    });
  }

  function makeLineChart(canvas, labels, values, label) {
    if (!canvas) return null;
    return new Chart(canvas, {
      type: "line",
      data: { labels, datasets: [{ label, data: values, tension: 0.2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, precision: 0 } }
      }
    });
  }

  // by pilier / bureau / type / statut planif (inchangé)
  makeBarChart(ctxPilier, groupCount(data, (r) => r.pilier), "Activités");
  makeBarChart(ctxBureau, groupCount(data, (r) => r.bureau), "Activités");
  makeBarChart(ctxType, groupCount(data, (r) => r.type_activite), "Activités");
  makeBarChart(ctxStatutPlanif, groupCount(data, (r) => r.statut_planificateur), "Activités");

  // -------------------------
  // Trend weekly (date_debut)  ✅ MODIF ICI
  // -------------------------
  const byWeek = new Map();
  data.forEach((r) => {
    const wk = isoWeekKey(r.date_debut);
    if (!wk) return;
    byWeek.set(wk, (byWeek.get(wk) || 0) + 1);
  });

  const trendLabels = Array.from(byWeek.keys()).sort((a, b) => a.localeCompare(b));
  const trendValues = trendLabels.map((k) => byWeek.get(k));
  makeLineChart(ctxTrend, trendLabels, trendValues, "Activités");

  // -------------------------
  // Top activités à risque (inchangé)
  // -------------------------
  if (riskBody) {
    const top = data
      .slice()
      .sort((a, b) => {
        // 1) overdue d'abord
        const oa = isOverdue(a) ? 1 : 0;
        const ob = isOverdue(b) ? 1 : 0;
        if (oa !== ob) return ob - oa;

        // 2) priorité risque
        const ra = priorityRank(a.risque_priorite);
        const rb = priorityRank(b.risque_priorite);
        if (ra !== rb) return rb - ra;

        // 3) date_fin la plus proche
        return (a.date_fin || "9999-12-31").localeCompare(b.date_fin || "9999-12-31");
      })
      .slice(0, 12);

    riskBody.innerHTML = top
      .map((r) => {
        const pct = num(r.avancement_pct);
        const pctTxt = pct === null ? "—" : `${Math.round(pct)}%`;

        return `
          <tr>
            <td class="col-code">${esc(r.code_activite || "")}</td>
            <td class="col-title">${esc(r.titre || "")}</td>
            <td>${esc(r.date_debut || "")}</td>
            <td>${esc(r.date_fin || "")}</td>
            <td>${esc(r.risque_priorite || (isOverdue(r) ? "En retard" : ""))}</td>
            <td>${esc(pctTxt)}</td>
          </tr>
        `;
      })
      .join("");
  }
})();
