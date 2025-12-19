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

  // Guard (évite crash si mauvais fichier HTML)
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

  const uniq = (arr) =>
    Array.from(new Set(arr.filter(Boolean).map(v => String(v).trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function isOverdue(r) {
    return r.overdue === 1;
  }

  // =====================================================
  // 4) Filtres
  // =====================================================
  fillSelect(elPilier, uniq(data.map(d => d.pilier)), "Tous les piliers");
  fillSelect(elBureau, uniq(data.map(d => d.bureau)), "Tous les bureaux");
  fillSelect(elStatutPlanif, uniq(data.map(d => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map(d => d.statut_suivi)), "Tous statuts (suivi)");

  // =====================================================
  // 5) Filtrage
  // =====================================================
  function apply() {
    const q = (elQ?.value || "").toLowerCase().trim();
    const pilier = elPilier?.value || "";
    const bureau = elBureau?.value || "";
    const sp = elStatutPlanif?.value || "";
    const ss = elStatutSuivi?.value || "";
    const from = elFrom?.value || "";
    const to = elTo?.value || "";
    const scope = elScope?.value || "all";

    const filtered = data.filter(r => {
      if (pilier && r.pilier !== pilier) return false;
      if (bureau && r.bureau !== bureau) return false;
      if (sp && r.statut_planificateur !== sp) return false;
      if (ss && r.statut_suivi !== ss) return false;

      if (from && r.date_debut && r.date_debut < from) return false;
      if (to && r.date_debut && r.date_debut > to) return false;

      if (scope === "overdue" && !isOverdue(r)) return false;
      if (scope === "withFollowup" && !(r.commentaire_suivi || "").trim()) return false;

      if (!q) return true;

      const blob = [
        r.code_activite,
        r.titre,
        r.type_activite,
        r.pilier,
        r.bureau,
        (r.unites_impliquees || []).join(" "),
        r.statut_planificateur,
        r.statut_suivi,
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
  // 6) Rendu tableau
  // =====================================================
  function render(rows) {
    const sorted = rows.slice().sort((a, b) => {
      if (a.date_debut !== b.date_debut) {
        return (a.date_debut || "").localeCompare(b.date_debut || "");
      }
      return (a.code_activite || "").localeCompare(b.code_activite || "");
    });

    tbody.innerHTML = sorted.map(r => {
      const overdueClass = isOverdue(r) ? " badge--danger" : "";
      const maj = r.date_mise_a_jour || r.submission_time || "";

      // Progress bar %
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

      return `
        <tr>
          <td class="col-code">${esc(r.code_activite || "")}</td>

          <td class="col-title">
            ${esc(r.titre || "")}
            <span class="cell-sub">
              ${esc(r.type_activite || "")} • ${esc(r.bureau || "")} • ${esc(r.pilier || "")}
            </span>
          </td>

          <td>${esc((r.unites_impliquees || []).join("; "))}</td>
          <td>${esc(r.date_debut || "")}</td>
          <td>${esc(r.date_fin || "")}</td>

          <td>
            <span class="badge${overdueClass}">
              ${esc(r.statut_planificateur || "")}
            </span>
          </td>

          <td>${esc(r.statut_suivi || "")}</td>

          <td class="col-pct">${progressHTML}</td>

          <td class="notes">${esc(r.commentaire_suivi || "")}</td>
          <td>${esc(r.validation || "")}</td>
          <td>${esc(maj)}</td>
        </tr>
      `;
    }).join("");
  }

  // =====================================================
  // 7) Events
  // =====================================================
  [elQ, elPilier, elBureau, elStatutPlanif, elStatutSuivi, elFrom, elTo, elScope]
    .filter(Boolean)
    .forEach(el => {
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

  // 1er rendu
  apply();

  // =====================================================
  // 8) Activer le drag & resize des colonnes (IMPORTANT)
  // =====================================================
  if (window.enableColumnResize) {
    window.enableColumnResize("#tbl", { minPx: 80 });
  } else {
    console.warn("enableColumnResize not found. Check that assets/col-resize.js is loaded before app-table.js");
  }
})();
