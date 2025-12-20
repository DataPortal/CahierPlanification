// assets/app-table.js
(async function () {
  "use strict";

  // =====================================================
  // 1) Charger les activités normalisées
  // =====================================================
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

  // =====================================================
  // 2) DOM
  // =====================================================
  const $ = (id) => document.getElementById(id);

  const elQ = $("q");
  const elBureau = $("bureau");
  const elPilier = $("pilier");
  const elStatutPlanif = $("statutPlanif");
  const elStatutSuivi = $("statutSuivi");
  const elFrom = $("from");
  const elTo = $("to");
  const elScope = $("scope");
  const elReset = $("reset");
  const elMeta = $("meta");
  const tbody = document.querySelector("#tbl tbody");

  if (!tbody || !elMeta || !elReset) {
    console.error("DOM table elements missing. This script must run on index.html.");
    return;
  }

  // =====================================================
  // 3) Utils
  // =====================================================
  const esc = window.escHTML || ((v) => (v == null ? "" : String(v)));

  const uniq = (arr) =>
    Array.from(new Set(arr.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function isOverdue(r) {
    return r && r.overdue === 1;
  }

  function hasFollowup(r) {
    return !!(r && String(r.commentaire_suivi || "").trim());
  }

  function numOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Badge class (optionnel)
  function statusBadgeClass(txt) {
    const t = String(txt || "").toLowerCase();
    if (!t) return "";
    if (t.includes("retard") || t.includes("over")) return " badge--danger";
    if (t.includes("final") || t.includes("clôt") || t.includes("term")) return " badge--success";
    if (t.includes("cours")) return " badge--info";
    if (t.includes("plan")) return " badge--warning";
    if (t.includes("annul")) return " badge--danger";
    return "";
  }

  // =====================================================
  // 4) Filtres (depuis activities.json)
  // =====================================================
  fillSelect(elBureau, uniq(data.map((d) => d.bureau)), "Tous les bureaux");
  fillSelect(elPilier, uniq(data.map((d) => d.pilier)), "Tous les piliers");
  fillSelect(elStatutPlanif, uniq(data.map((d) => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map((d) => d.statut_suivi)), "Tous statuts (suivi)");

  // =====================================================
  // 5) Filtrage
  // =====================================================
  function apply() {
    const q = (elQ?.value || "").toLowerCase().trim();
    const bureau = elBureau?.value || "";
    const pilier = elPilier?.value || "";
    const sp = elStatutPlanif?.value || "";
    const ss = elStatutSuivi?.value || "";
    const from = elFrom?.value || "";
    const to = elTo?.value || "";
    const scope = elScope?.value || "all";

    const filtered = data.filter((r) => {
      if (bureau && r.bureau !== bureau) return false;
      if (pilier && r.pilier !== pilier) return false;
      if (sp && r.statut_planificateur !== sp) return false;
      if (ss && r.statut_suivi !== ss) return false;

      // filtre période sur date_debut
      if (from && r.date_debut && r.date_debut < from) return false;
      if (to && r.date_debut && r.date_debut > to) return false;

      if (scope === "overdue" && !isOverdue(r)) return false;
      if (scope === "withFollowup" && !hasFollowup(r)) return false;

      if (!q) return true;

      const blob = [
        r.code_activite,
        r.bureau,
        r.pilier,
        r.titre,
        r.type_activite,
        r.objectif,
        r.livrable_attendu,
        r.risque_priorite,
        r.date_debut,
        r.date_fin,
        r.responsable,
        r.statut_planificateur,
        r.statut_suivi,
        r.avancement_pct,
        r.taux_avancement_calc,
        r.commentaire_suivi,
        r.validation,
        r.commentaire_validation,
      ]
        .map((x) => (x == null ? "" : String(x)))
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  // =====================================================
  // 6) Rendu tableau
  // =====================================================
  function render(rows) {
    const sorted = rows.slice().sort((a, b) => {
      // tri: bureau, pilier, date_debut, code
      const ba = (a.bureau || "").localeCompare(b.bureau || "");
      if (ba !== 0) return ba;
      const pa = (a.pilier || "").localeCompare(b.pilier || "");
      if (pa !== 0) return pa;
      if (a.date_debut !== b.date_debut) return (a.date_debut || "").localeCompare(b.date_debut || "");
      return (a.code_activite || "").localeCompare(b.code_activite || "");
    });

    tbody.innerHTML = sorted
      .map((r) => {
        const overdueClass = isOverdue(r) ? " badge--danger" : "";
        const spClass = statusBadgeClass(r.statut_planificateur);
        const ssClass = statusBadgeClass(r.statut_suivi);

        // Progress bar (%)
        const pctNum = numOrNull(r.avancement_pct);

        let progressHTML = `
          <div class="progress progress--empty">
            <div class="progress-track">
              <div class="progress-bar" style="width:0%"></div>
            </div>
            <div class="progress-val">—</div>
          </div>`;

        if (pctNum !== null) {
          const pct = Math.max(0, Math.min(100, Math.round(pctNum)));
          progressHTML = `
            <div class="progress">
              <div class="progress-track">
                <div class="progress-bar" style="width:${pct}%"></div>
              </div>
              <div class="progress-val">${pct}%</div>
            </div>`;
        }

        const pctCalc = numOrNull(r.taux_avancement_calc);
        const pctCalcTxt = pctCalc === null ? "—" : String(Math.round(pctCalc));

        return `
          <tr>
            <!-- Ordre demandé -->
            <td class="col-code">${esc(r.code_activite || "")}</td>
            <td>${esc(r.bureau || "")}</td>
            <td>${esc(r.pilier || "")}</td>

            <td class="col-title">
              ${esc(r.titre || "")}
              <span class="cell-sub">${esc(r.type_activite || "")}</span>
            </td>

            <td>${esc(r.type_activite || "")}</td>
            <td>${esc(r.objectif || "")}</td>
            <td>${esc(r.livrable_attendu || "")}</td>
            <td>${esc(r.risque_priorite || "")}</td>

            <td>${esc(r.date_debut || "")}</td>
            <td>${esc(r.date_fin || "")}</td>

            <td>${esc(r.responsable || "")}</td>

            <td>
              <span class="badge${spClass}${overdueClass}">
                ${esc(r.statut_planificateur || "")}
              </span>
            </td>

            <td>
              <span class="badge${ssClass}">
                ${esc(r.statut_suivi || "")}
              </span>
            </td>

            <td class="col-pct">${progressHTML}</td>
            <td>${esc(pctCalcTxt)}</td>

            <td class="notes">${esc(r.commentaire_suivi || "")}</td>
            <td>${esc(r.validation || "")}</td>
            <td>${esc(r.commentaire_validation || "")}</td>
          </tr>
        `;
      })
      .join("");
  }

  // =====================================================
  // 7) Events
  // =====================================================
  [elQ, elBureau, elPilier, elStatutPlanif, elStatutSuivi, elFrom, elTo, elScope]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener("input", apply);
      el.addEventListener("change", apply);
    });

  elReset.addEventListener("click", () => {
    elQ.value = "";
    elBureau.value = "";
    elPilier.value = "";
    elStatutPlanif.value = "";
    elStatutSuivi.value = "";
    elFrom.value = "";
    elTo.value = "";
    elScope.value = "all";
    apply();
  });

  apply();

  // Activer le drag & resize des colonnes
  if (window.enableColumnResize) {
    window.enableColumnResize("#tbl", { minPx: 80 });
  }
})();
