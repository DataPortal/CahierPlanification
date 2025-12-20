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
  const elTypeAct = $("typeAct");
  const elRisque = $("risque");

  const elStatutPlanif = $("statutPlanif");
  const elStatutSuivi = $("statutSuivi");
  const elFrom = $("from");
  const elTo = $("to");
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
  const esc = (v) =>
    (v == null ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const norm = (v) => (v || "").toString().trim().toLowerCase();

  const uniq = (arr) =>
    Array.from(new Set(arr.filter(v => v !== null && v !== undefined).map(v => String(v).trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function isOverdue(r) {
    return r && r.overdue === 1;
  }

  function parsePct(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n));
  }

  // Progress bar HTML
  function buildProgress(pctValue) {
    const pctNum = parsePct(pctValue);

    if (pctNum === null) {
      return `
        <div class="progress progress--empty">
          <div class="progress-track">
            <div class="progress-bar" style="width:0%"></div>
          </div>
          <div class="progress-val">—</div>
        </div>`;
    }

    const pct = Math.round(pctNum);
    return `
      <div class="progress">
        <div class="progress-track">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="progress-val">${pct}%</div>
      </div>`;
  }

  // =====================================================
  // 4) Filtres (depuis activities.json)
  // =====================================================
  fillSelect(elBureau, uniq(data.map(d => d.bureau)), "Tous les bureaux");
  fillSelect(elPilier, uniq(data.map(d => d.pilier)), "Tous les piliers");
  fillSelect(elTypeAct, uniq(data.map(d => d.type_activite)), "Tous les types");
  fillSelect(elRisque, uniq(data.map(d => d.risque_priorite)), "Tous les risques");

  fillSelect(elStatutPlanif, uniq(data.map(d => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map(d => d.statut_suivi)), "Tous statuts (suivi)");

  // =====================================================
  // 5) Filtrage
  // =====================================================
  function apply() {
    const q = norm(elQ?.value);
    const bureau = elBureau?.value || "";
    const pilier = elPilier?.value || "";
    const typeAct = elTypeAct?.value || "";
    const risque = elRisque?.value || "";

    const sp = elStatutPlanif?.value || "";
    const ss = elStatutSuivi?.value || "";

    const from = elFrom?.value || "";
    const to = elTo?.value || "";

    const filtered = data.filter(r => {
      if (bureau && r.bureau !== bureau) return false;
      if (pilier && r.pilier !== pilier) return false;
      if (typeAct && r.type_activite !== typeAct) return false;
      if (risque && r.risque_priorite !== risque) return false;

      if (sp && r.statut_planificateur !== sp) return false;
      if (ss && r.statut_suivi !== ss) return false;

      if (from && r.date_debut && r.date_debut < from) return false;
      if (to && r.date_debut && r.date_debut > to) return false;

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
        r.responsable,
        r.statut_planificateur,
        r.statut_suivi,
        r.commentaire_suivi
      ].join(" ").toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  // =====================================================
  // 6) Rendu tableau (ordre colonnes demandé)
  // =====================================================
  function render(rows) {
    const sorted = rows.slice().sort((a, b) => {
      // tri stable: début puis code
      if ((a.date_debut || "") !== (b.date_debut || "")) return (a.date_debut || "").localeCompare(b.date_debut || "");
      return (a.code_activite || "").localeCompare(b.code_activite || "");
    });

    tbody.innerHTML = sorted.map(r => {
      const overdueClass = isOverdue(r) ? " badge--danger" : "";
      const progressHTML = buildProgress(r.avancement_pct);

      return `
        <tr>
          <td class="col-code">${esc(r.code_activite || "")}</td>

          <td>${esc(r.bureau || "")}</td>
          <td>${esc(r.pilier || "")}</td>

          <td class="col-title">
            ${esc(r.titre || "")}
            <span class="cell-sub">${esc(r.type_activite || "")} • ${esc(r.risque_priorite || "")} • ${esc(r.responsable || "")}</span>
          </td>

          <td>${esc(r.type_activite || "")}</td>
          <td>${esc(r.objectif || "")}</td>
          <td>${esc(r.livrable_attendu || "")}</td>
          <td>${esc(r.risque_priorite || "")}</td>

          <td>${esc(r.date_debut || "")}</td>
          <td>${esc(r.date_fin || "")}</td>

          <td>${esc(r.responsable || "")}</td>

          <td>
            <span class="badge${overdueClass}">${esc(r.statut_planificateur || "")}</span>
          </td>

          <td>${esc(r.statut_suivi || "")}</td>

          <td class="col-pct">${progressHTML}</td>

          <td class="notes">${esc(r.commentaire_suivi || "")}</td>
        </tr>
      `;
    }).join("");
  }

  // =====================================================
  // 7) Events
  // =====================================================
  [
    elQ, elBureau, elPilier, elTypeAct, elRisque,
    elStatutPlanif, elStatutSuivi, elFrom, elTo
  ]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener("input", apply);
      el.addEventListener("change", apply);
    });

  elReset.addEventListener("click", () => {
    elQ.value = "";
    elBureau.value = "";
    elPilier.value = "";
    elTypeAct.value = "";
    elRisque.value = "";
    elStatutPlanif.value = "";
    elStatutSuivi.value = "";
    elFrom.value = "";
    elTo.value = "";
    apply();
  });

  apply();

  // =====================================================
  // 8) Drag & resize colonnes (si la fonction existe)
  // =====================================================
  if (window.enableColumnResize) {
    window.enableColumnResize("#tbl", { minPx: 80 });
  }
})();
