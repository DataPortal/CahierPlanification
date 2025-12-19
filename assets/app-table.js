(async function () {
  const data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => r.json());

  const elQ = document.getElementById("q");
  const elPilier = document.getElementById("pilier");
  const elBureau = document.getElementById("bureau");
  const elStatutPlanif = document.getElementById("statutPlanif");
  const elStatutSuivi = document.getElementById("statutSuivi");
  const elFrom = document.getElementById("from");
  const elTo = document.getElementById("to");
  const elScope = document.getElementById("scope");
  const elReset = document.getElementById("reset");
  const elMeta = document.getElementById("meta");
  const tbody = document.querySelector("#tbl tbody");

  fillSelect(elPilier, unique(data.map(d => d.pilier)), "Tous les piliers");
  fillSelect(elBureau, unique(data.map(d => d.bureau)), "Tous les bureaux");
  fillSelect(elStatutPlanif, unique(data.map(d => d.statut_planificateur)), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, unique(data.map(d => d.statut_suivi)), "Tous statuts (suivi)");

  function apply() {
    const q = (elQ.value || "").toLowerCase().trim();
    const pilier = elPilier.value || "";
    const bureau = elBureau.value || "";
    const sp = elStatutPlanif.value || "";
    const ss = elStatutSuivi.value || "";
    const from = elFrom.value || "";
    const to = elTo.value || "";
    const scope = elScope.value || "all";

    const filtered = data.filter(d => {
      if (pilier && (d.pilier || "") !== pilier) return false;
      if (bureau && (d.bureau || "") !== bureau) return false;
      if (sp && (d.statut_planificateur || "") !== sp) return false;
      if (ss && (d.statut_suivi || "") !== ss) return false;

      const sd = (d.date_debut || "");
      if (from && sd && sd < from) return false;
      if (to && sd && sd > to) return false;

      if (scope === "overdue" && d.overdue !== 1) return false;
      if (scope === "withFollowup" && !(d.commentaire_suivi || "").trim()) return false;

      if (!q) return true;

      const blob = [
        d.code_activite, d.titre, d.type_activite, d.pilier, d.bureau,
        (d.unites_impliquees || []).join(" "),
        d.responsable, d.statut_planificateur, d.statut_suivi,
        d.commentaire_suivi, d.validation
      ].join(" ").toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  function render(rows) {
    tbody.innerHTML = rows.map(r => {
      const units = (r.unites_impliquees || []).join("; ");
      const pct = (r.avancement_pct === null || r.avancement_pct === undefined) ? "" : `${r.avancement_pct}`;
      const maj = r.date_mise_a_jour || r.submission_time || "";
      const overdueMark = (r.overdue === 1) ? " badge--danger" : "";

      return `
        <tr>
          <td class="strong">${escapeHtml(r.code_activite || "")}</td>
          <td class="strong">${escapeHtml(r.titre || "")}</td>
          <td>${escapeHtml(r.type_activite || "")}</td>
          <td>${escapeHtml(r.pilier || "")}</td>
          <td>${escapeHtml(r.bureau || "")}</td>
          <td>${escapeHtml(units)}</td>
          <td>${escapeHtml(r.date_debut || "")}</td>
          <td>${escapeHtml(r.date_fin || "")}</td>
          <td><span class="badge${overdueMark}">${escapeHtml(r.statut_planificateur || "")}</span></td>
          <td>${escapeHtml(r.statut_suivi || "")}</td>
          <td>${escapeHtml(pct)}</td>
          <td class="notes">${escapeHtml(r.commentaire_suivi || "")}</td>
          <td>${escapeHtml(r.validation || "")}</td>
          <td>${escapeHtml(maj)}</td>
        </tr>
      `;
    }).join("");
  }

  [elQ, elPilier, elBureau, elStatutPlanif, elStatutSuivi, elFrom, elTo, elScope].forEach(el => {
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

  apply();
})();
