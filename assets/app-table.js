(async function () {
  // =====================================================
  // 1) Charger les activités normalisées
  // =====================================================
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

  // =====================================================
  // 2) DOM
  // =====================================================
  const $ = (id) => document.getElementById(id);

  const elQ = $("q");
  const elBureau = $("bureau");
  const elPilier = $("pilier");
  const elRisque = $("risque");
  const elTypeAct = $("typeActivite");

  const elStatutPlanif = $("statutPlanif");
  const elStatutSuivi = $("statutSuivi");
  const elFrom = $("from");
  const elTo = $("to");
  const elScope = $("scope");
  const elReset = $("reset");
  const elMeta = $("meta");
  const tbody = document.querySelector("#tbl tbody");

  if (!tbody || !elMeta || !elReset) {
    console.error("DOM elements missing. This script must run on index.html.");
    return;
  }

  // =====================================================
  // 3) Utils
  // =====================================================
  const esc = (v) =>
    (v == null ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const uniq = (arr) =>
    Array.from(
      new Set(
        arr
          .filter(v => v !== null && v !== undefined)
          .map(v => String(v).trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function isOverdue(r) {
    return r && r.overdue === 1;
  }

  function isHighRisk(r) {
    const x = (r?.risque_priorite || "").toString().toLowerCase();
    // Ajustez les mots-clés si votre saisie diffère
    return ["élev", "ele", "haut", "crit"].some(k => x.includes(k));
  }

  // =====================================================
  // 4) Filtres (depuis activities.json)
  // =====================================================
  fillSelect(elBureau, uniq(data.map(d => d.bureau)), "Tous les bureaux");
  fillSelect(elPilier, uniq(data.map(d => d.pilier)), "Tous les piliers");
  fillSelect(elRisque, uniq(data.map(d => d.risque_priorite)), "Tous risques");
  fillSelect(elTypeAct, uniq(data.map(d => d.type_activite)), "Tous types");

  fillSelect(elStatutPlanif, uniq(data.map(d => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map(d => d.statut_suivi)), "Tous statuts (suivi)");

  // =====================================================
  // 5) Filtrage
  // =====================================================
  function apply() {
    const q = (elQ?.value || "").toLowerCase().trim();

    const bureau = elBureau?.value || "";
    const pilier = elPilier?.value || "";
    const risque = elRisque?.value || "";
    const typeAct = elTypeAct?.value || "";

    const sp = elStatutPlanif?.value || "";
    const ss = elStatutSuivi?.value || "";
    const from = elFrom?.value || "";
    const to = elTo?.value || "";
    const scope = elScope?.value || "all";

    const filtered = data.filter(r => {
      if (bureau && (r.bureau || "") !== bureau) return false;
      if (pilier && (r.pilier || "") !== pilier) return false;
      if (risque && (r.risque_priorite || "") !== risque) return false;
      if (typeAct && (r.type_activite || "") !== typeAct) return false;

      if (sp && (r.statut_planificateur || "") !== sp) return false;
      if (ss && (r.statut_suivi || "") !== ss) return false;

      if (from && r.date_debut && r.date_debut < from) return false;
      if (to && r.date_debut && r.date_debut > to) return false;

      if (scope === "overdue" && !isOverdue(r)) return false;
      if (scope === "risk" && !isHighRisk(r)) return false;
      if (scope === "withFollowup" && !((r.commentaire_suivi || "").toString().trim())) return false;

      if (!q) return true;

      const blob = [
        r.code_activite,
        r.bureau,
        r.pilier,
        r.titre,
        r.type_activite,
        r.objectif,
        r.livrable,
        r.risque_priorite,
        r.responsable,
        r.statut_planificateur,
        r.statut_suivi,
        r.avancement_pct,
        r.taux_avancement_calc,
        r.commentaire_suivi,
        r.validation,
        r.commentaire_validation,
      ].join(" ").toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  // =====================================================
  // 6) Rendu tableau – ORDRE EXACT demandé
  // =====================================================
  function render(rows) {
    const sorted = rows.slice().sort((a, b) => {
      const da = (a.date_debut || "");
      const db = (b.date_debut || "");
      if (da !== db) return da.localeCompare(db);
      return (a.code_activite || "").localeCompare(b.code_activite || "");
    });

    tbody.innerHTML = sorted.map(r => {
      const overdueClass = isOverdue(r) ? " badge--danger" : "";

      // Progress bar % (avancement_pct)
      const rawPct = r.avancement_pct;
      const pctNum = (rawPct === null || rawPct === undefined || rawPct === "")
        ? null
        : Number(rawPct);

      let progressHTML = `
        <div class="progress progress--empty">
          <div class="progress-track">
            <div class="progress-bar" style="width:0%"></div>
          </div>
          <div class="progress-val">—</div>
        </div>`;

      if (pctNum !== null && !Number.isNaN(pctNum)) {
        const pct = Math.max(0, Math.min(100, Math.round(pctNum)));
        progressHTML = `
          <div class="progress">
            <div class="progress-track">
              <div class="progress-bar" style="width:${pct}%"></div>
            </div>
            <div class="progress-val">${pct}%</div>
          </div>`;
      }

      const tauxCalc = (r.taux_avancement_calc === null || r.taux_avancement_calc === undefined || r.taux_avancement_calc === "")
        ? ""
        : String(r.taux_avancement_calc);

      return `
        <tr>
          <td class="col-code">${esc(r.code_activite || "")}</td>
          <td class="col-bureau">${esc(r.bureau || "")}</td>
          <td class="col-pilier">${esc(r.pilier || "")}</td>

          <td class="col-title">${esc(r.titre || "")}</td>

          <td class="col-type">${esc(r.type_activite || "")}</td>
          <td class="col-obj">${esc(r.objectif || "")}</td>
          <td class="col-livrable">${esc(r.livrable || "")}</td>
          <td class="col-risque">${esc(r.risque_priorite || "")}</td>

          <td class="col-date">${esc(r.date_debut || "")}</td>
          <td class="col-date">${esc(r.date_fin || "")}</td>

          <td class="col-resp">${esc(r.responsable || "")}</td>

          <td class="col-status">
            <span class="badge${overdueClass}">${esc(r.statut_planificateur || "")}</span>
          </td>
          <td class="col-status">${esc(r.statut_suivi || "")}</td>

          <td class="col-pct">${progressHTML}</td>
          <td class="col-pctcalc">${esc(tauxCalc)}</td>

          <td class="col-notes notes">${esc(r.commentaire_suivi || "")}</td>
          <td class="col-valid">${esc(r.validation || "")}</td>
          <td class="col-validcom">${esc(r.commentaire_validation || "")}</td>
        </tr>
      `;
    }).join("");
  }

  // =====================================================
  // 7) Events
  // =====================================================
  [
    elQ, elBureau, elPilier, elRisque, elTypeAct,
    elStatutPlanif, elStatutSuivi, elFrom, elTo, elScope
  ].filter(Boolean).forEach(el => {
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  elReset.addEventListener("click", () => {
    elQ.value = "";
    elBureau.value = "";
    elPilier.value = "";
    elRisque.value = "";
    elTypeAct.value = "";
    elStatutPlanif.value = "";
    elStatutSuivi.value = "";
    elFrom.value = "";
    elTo.value = "";
    elScope.value = "all";
    apply();
  });

  apply();

  // Activer le drag & resize des colonnes (#tbl)
  if (window.enableColumnResize) {
    window.enableColumnResize("#tbl", { minPx: 80 });
  }
})();
