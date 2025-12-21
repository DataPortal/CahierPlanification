// assets/app-dashboard.js (REVISÉ)
// - Tri "ordre d’enregistrement" (dernier en 1er) pour la table Risques
// - Trend: weekly (inchangé)
// - KPIs: inchangés
// - Table "Top activités en retard / à risque":
//   * affiche Responsable
//   * utilise Statut de suivi (pas Statut planif) dans la colonne statut
//   * critères de risque: date_fin dépassée (si pas finalisée) OU statut_suivi ∈ {Retard, Annulée, Reportée}
//   * tie-breaker: score risque, puis date_fin, puis ordre d’enregistrement, puis code

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
  const riskMeta = $("riskMeta");

  // -------------------------
  // Utils
  // -------------------------
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function hasFollowup(r) {
    return !!(r && String(r.commentaire_suivi || "").trim());
  }

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function normalizeStatusSuivi(v) {
    const t = normalizeText(v);
    const low = t.toLowerCase();
    if (!t) return "";
    if (low.includes("retard")) return "Retard";
    if (low.includes("annul")) return "Annulée";
    if (low.includes("report")) return "Reportée";
    return t;
  }

  function isDoneLike(statusAny) {
    const low = String(statusAny || "").toLowerCase();
    return (
      low.includes("final") ||
      low.includes("clôt") ||
      low.includes("clot") ||
      low.includes("termin") ||
      low.includes("achev") ||
      low.includes("done") ||
      low.includes("complete") ||
      low.includes("complét") ||
      low.includes("annul") // si vous considérez "annulée" comme clôture opérationnelle
    );
  }

  function isLateStatus(statusSuivi) {
    const low = String(statusSuivi || "").toLowerCase();
    return low.includes("retard");
  }

  function isCancelledLike(statusSuivi) {
    const low = String(statusSuivi || "").toLowerCase();
    return low.includes("annul");
  }

  function isReportedLike(statusSuivi) {
    const low = String(statusSuivi || "").toLowerCase();
    return low.includes("report");
  }

  function isOverdueByDate(dateFinISO, statusSuivi, statusPlanif) {
    if (!dateFinISO) return false;
    const d = new Date(String(dateFinISO).slice(0, 10) + "T00:00:00");
    if (Number.isNaN(d.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const combined = `${statusSuivi || ""} ${statusPlanif || ""}`;
    // Si finalisée/terminée/annulée, pas en retard "date" même si date dépassée
    if (isDoneLike(combined)) return false;

    return d < today;
  }

  function riskPriorityRank(p) {
    const t = String(p || "").toLowerCase();
    if (t.includes("criti")) return 4;
    if (t.includes("élev") || t.includes("eleve")) return 3;
    if (t.includes("moy")) return 2;
    if (t.includes("faib")) return 1;
    return 0;
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
    const parts = String(isoDate).slice(0, 10).split("-");
    if (parts.length !== 3) return null;

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    const dt = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dt.getTime())) return null;

    const day = dt.getUTCDay() || 7; // Mon=1..Sun=7
    dt.setUTCDate(dt.getUTCDate() + 4 - day);

    const isoYear = dt.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);

    const ww = String(weekNo).padStart(2, "0");
    return `${isoYear}-W${ww}`;
  }

  // ---- Ordre d’enregistrement (dernier en 1er) ----
  function parseTime(v) {
    if (!v) return NaN;
    const t = Date.parse(v);
    return Number.isNaN(t) ? NaN : t;
  }

  function recordTime(r) {
    return (
      parseTime(r.submission_time) ||
      parseTime(r.date_mise_a_jour) ||
      parseTime(r.end) ||
      parseTime(r.start) ||
      0
    );
  }

  // -------------------------
  // KPIs (inchangé)
  // -------------------------
  const total = data.length;

  const overdueCount = data.filter(
    (r) =>
      isOverdueByDate(r.date_fin, r.statut_suivi, r.statut_planificateur) ||
      isLateStatus(r.statut_suivi)
  ).length;

  const withFollowup = data.filter(hasFollowup).length;

  const pctValues = data.map((r) => num(r.avancement_pct)).filter((x) => x !== null);

  const avg = pctValues.length
    ? Math.round(pctValues.reduce((a, b) => a + b, 0) / pctValues.length)
    : null;

  if (elTotal) elTotal.textContent = String(total);
  if (elOverdue) elOverdue.textContent = String(overdueCount);
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
          y: { beginAtZero: true, precision: 0 },
        },
      },
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
        scales: { y: { beginAtZero: true, precision: 0 } },
      },
    });
  }

  // by pilier / bureau / type / statut planif (inchangé)
  makeBarChart(ctxPilier, groupCount(data, (r) => r.pilier), "Activités");
  makeBarChart(ctxBureau, groupCount(data, (r) => r.bureau), "Activités");
  makeBarChart(ctxType, groupCount(data, (r) => r.type_activite), "Activités");
  makeBarChart(ctxStatutPlanif, groupCount(data, (r) => r.statut_planificateur), "Activités");

  // -------------------------
  // Trend weekly (date_debut)
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
  // Top activités en retard / à risque
  // Nouveau critère:
  // - ne garde QUE si:
  //   a) date_fin dépassée (si non finalisée)
  //   OU
  //   b) statut_suivi ∈ {Retard, Annulée, Reportée}
  // - tri:
  //   1) score risque DESC
  //   2) date_fin ASC (plus urgente)
  //   3) ordre d’enregistrement DESC (dernier d’abord)
  //   4) code
  // -------------------------
  function qualifiesRisk(r) {
    const stSuivi = normalizeStatusSuivi(r.statut_suivi);
    const stPlan = normalizeText(r.statut_planificateur);

    const overdueDate = isOverdueByDate(r.date_fin, stSuivi, stPlan);
    const late = isLateStatus(stSuivi);
    const cancelled = isCancelledLike(stSuivi);
    const reported = isReportedLike(stSuivi);

    return overdueDate || late || cancelled || reported;
  }

  function riskScore(r) {
    const stSuivi = normalizeStatusSuivi(r.statut_suivi);
    const stPlan = normalizeText(r.statut_planificateur);

    const overdueDate = isOverdueByDate(r.date_fin, stSuivi, stPlan);
    const late = isLateStatus(stSuivi);
    const cancelled = isCancelledLike(stSuivi);
    const reported = isReportedLike(stSuivi);

    // pondérations (gardées, mais centrées sur vos critères)
    let score = 0;
    if (overdueDate) score += 100;
    if (late) score += 90;
    if (cancelled) score += 70;
    if (reported) score += 60;

    // priorité comme renfort
    score += riskPriorityRank(r.risque_priorite) * 10;

    // si finalisée, rabaisser fortement
    if (isDoneLike(`${stSuivi} ${stPlan}`)) score -= 200;

    return score;
  }

  if (riskBody) {
    const top = data
      .filter(qualifiesRisk)
      .slice()
      .sort((a, b) => {
        const sa = riskScore(a);
        const sb = riskScore(b);
        if (sa !== sb) return sb - sa;

        // tie-breaker 1: date_fin la plus proche
        const da = a.date_fin || "9999-12-31";
        const db = b.date_fin || "9999-12-31";
        if (da !== db) return da.localeCompare(db);

        // tie-breaker 2: ordre d’enregistrement (dernier en premier)
        const tb = recordTime(b);
        const ta = recordTime(a);
        if (tb !== ta) return tb - ta;

        // tie-breaker 3: code
        return (a.code_activite || "").localeCompare(b.code_activite || "");
      })
      .slice(0, 12);

    if (riskMeta) {
      riskMeta.textContent = `${top.length} activité(s) à risque (affichage: top 12)`;
    }

    riskBody.innerHTML = top
      .map((r) => {
        const pct = num(r.avancement_pct);
        const pctTxt = pct === null ? "—" : `${Math.round(pct)}%`;

        const statutSuivi = normalizeStatusSuivi(r.statut_suivi);
        const statutSuiviShow = statutSuivi || "—";

        return `
          <tr>
            <td class="col-code">${esc(r.code_activite || "")}</td>
            <td class="col-title">${esc(r.titre || "")}</td>
            <td>${esc(r.responsable || "")}</td>
            <td>${esc(r.date_debut || "")}</td>
            <td>${esc(r.date_fin || "")}</td>
            <td>${esc(statutSuiviShow)}</td>
            <td>${esc(pctTxt)}</td>
          </tr>
        `;
      })
      .join("");
  }
})();
