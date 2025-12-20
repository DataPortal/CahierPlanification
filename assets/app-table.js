(async function () {
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
  const elPilier = $("pilier");
  const elBureau = $("bureau");
  const elStatutPlanif = $("statutPlanif");
  const elStatutSuivi = $("statutSuivi");
  const elFrom = $("from");
  const elTo = $("to");
  const elScope = $("scope");
  const elReset = $("reset");
  const elMeta = $("meta");
  const tbody = document.querySelector("#tbl tbody");

  // Guard: si le HTML ne correspond pas
  if (!tbody || !elMeta || !elReset) {
    console.error("DOM table elements missing. This script must run on index.html.");
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

  const norm = (v) => (v == null ? "" : String(v)).trim().toLowerCase();

  const uniq = (arr) =>
    Array.from(
      new Set(
        arr
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v).trim())
          .filter((v) => v !== "")
      )
    ).sort((a, b) => a.localeCompare(b));

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  // Overdue pré-calculé côté transform.py
  function isOverdue(r) {
    return r && r.overdue === 1;
  }

  // Pour un affichage “statut unique” côté tableau risque etc.
  function displayStatus(r) {
    return r.statut_suivi || r.statut_planificateur || "";
  }

  // Convertit (n'importe quoi) en nombre de 0..100 si possible
  function toPct(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n));
  }

  // =====================================================
  // 4) Filtres (depuis activities.json)
  // =====================================================
  fillSelect(elPilier, uniq(data.map((d) => d.pilier)), "Tous les piliers");
  fillSelect(elBureau, uniq(data.map((d) => d.bureau)), "Tous les bureaux");
  fillSelect(elStatutPlanif, uniq(data.map((d) => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map((d) => d.statut_suivi)), "Tous statuts (suivi)");

  // =====================================================
  // 5) Filtrage
  // =====================================================
  function apply() {
    const q = norm(elQ?.value || "");
    const pilier = elPilier?.value || "";
    const bureau = elBureau?.value || "";
    const sp = elStatutPlanif?.value || "";
    const ss = elStatutSuivi?.value || "";
    const from = elFrom?.value || "";
    const to = elTo?.value || "";
    const scope = elScope?.value || "all";

    const filtered = data.filter((r) => {
      if (!r) return false;

      if (pilier && r.pilier !== pilier) return false;
      if (bureau && r.bureau !== bureau) return false;
      if (sp && r.statut_planificateur !== sp) return false;
      if (ss && r.statut_suivi !== ss) return false;

      // Date filtre sur date_debut (format ISO AAAA-MM-JJ)
      if (from && r.date_debut && r.date_debut < from) return false;
      if (to && r.date_debut && r.date_debut > to) return false;

      // Scope
      if (scope === "overdue" && !isOverdue(r)) return false;
      if (scope === "withFollowup" && !(r.commentaire_suivi || "").trim()) return false;

      // Recherche plein texte
      if (!q) return true;

      const blob = [
        r.titre,
        r.objectif,
        r.livrable_attendu,
        r.type_activite,
        r.pilier,
        r.code_activite,
        r.bureau,
        r.risque_priorite,
        r.responsable,
        r.statut_planificateur,
        r.statut_suivi,
        r.avancement_pct,
        r.taux_avancement_calc,
        r.commentaire_suivi,
        r.validation,
        r.commentaire_validation,
      ]
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  // =====================================================
  // 6) Rendu tableau – toutes colonnes (18)
  // =====================================================
  function render(rows) {
    // Tri stable : date_debut puis code_activite
    const sorted = rows.slice().sort((a, b) => {
      const da = a?.date_debut || "";
      const db = b?.date_debut || "";
      if (da !== db) return da.localeCompare(db);
      return String(a?.code_activite || "").localeCompare(String(b?.code_activite || ""));
    });

    tbody.innerHTML = sorted
      .map((r) => {
        const overdueClass = isOverdue(r) ? " badge--danger" : "";
        const maj = r.date_mise_a_jour || r.submission_time || "";

        // Barre % = priorité à taux_avancement_calc si disponible, sinon avancement_pct
        const pctVal = toPct(r.taux_avancement_calc);
        const pctFallback = toPct(r.avancement_pct);
        const pct = pctVal !== null ? pctVal : pctFallback;

        let progressHTML = `
          <div class="progress progress--empty">
            <div class="progress-track">
              <div class="progress-bar" style="width:0%"></div>
            </div>
            <div class="progress-val">—</div>
          </div>`;

        if (pct !== null) {
          const p = Math.round(pct);
          progressHTML = `
            <div class="progress">
              <div class="progress-track">
                <div class="progress-bar" style="width:${p}%"></div>
              </div>
              <div class="progress-val">${p}%</div>
            </div>`;
        }

        // “Niveau d’avancement (%)” = barre ; “taux_avancement_calc” = valeur brute (ou vide)
        const tauxCalcTxt =
          r.taux_avancement_calc === null || r.taux_avancement_calc === undefined || r.taux_avancement_calc === ""
            ? ""
            : String(r.taux_avancement_calc);

        // 18 colonnes dans l’ordre EXACT de index.html
        return `
          <tr>
            <td class="col-title">
              ${esc(r.titre || "")}
              <span class="cell-sub">
                ${esc(r.type_activite || "")} • ${esc(r.bureau || "")} • ${esc(r.pilier || "")}
              </span>
            </td>

            <td class="col-obj">${esc(r.objectif || "")}</td>
            <td class="col-livrable">${esc(r.livrable_attendu || "")}</td>
            <td class="col-type">${esc(r.type_activite || "")}</td>
            <td class="col-pilier">${esc(r.pilier || "")}</td>

            <td class="col-code">${esc(r.code_activite || "")}</td>
            <td class="col-bureau">${esc(r.bureau || "")}</td>
            <td class="col-risque">${esc(r.risque_priorite || "")}</td>

            <td class="col-date">${esc(r.date_debut || "")}</td>
            <td class="col-date">${esc(r.date_fin || "")}</td>
            <td class="col-resp">${esc(r.responsable || "")}</td>

            <td class="col-status">
              <span class="badge${overdueClass}">
                ${esc(r.statut_planificateur || "")}
              </span>
            </td>

            <td class="col-status">${esc(r.statut_suivi || "")}</td>

            <td class="col-pct">${progressHTML}</td>
            <td class="col-pctcalc">${esc(tauxCalcTxt)}</td>

            <td class="col-notes notes">${esc(r.commentaire_suivi || "")}</td>
            <td class="col-valid">${esc(r.validation || "")}</td>
            <td class="col-validcom">${esc(r.commentaire_validation || "")}</td>
          </tr>
        `;
      })
      .join("");
  }

  // =====================================================
  // 7) Events
  // =====================================================
  [elQ, elPilier, elBureau, elStatutPlanif, elStatutSuivi, elFrom, elTo, elScope]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener("input", apply);
      el.addEventListener("change", apply);
    });

  elReset.addEventListener("click", () => {
    elQ.value = "";
    elPilier.value = "";
    elBureau.value = "";
    elStatutPlanif.value = "";
    elStatutSuivi.value = "";
    elFrom.value = "";
    elTo.value = "";
    elScope.value = "all";
    apply();
  });

  // Premier rendu
  apply();

  // =====================================================
  // 8) Drag & resize colonnes (si col-resize.js est chargé)
  // =====================================================
  if (window.enableColumnResize) {
    window.enableColumnResize("#tbl", { minPx: 80 });
  }
})();
