(async function () {
  const raw = await fetch("./data/submissions.json", { cache: "no-store" }).then(r => r.json());
  const data = (raw && raw.results) ? raw.results : raw; // au cas où

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

  // Utilitaires locaux (au cas où utils.js n'est pas chargé correctement)
  const esc = (v) => (v == null ? "" : String(v))
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean).map(x => String(x).trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  function units(r){
    const txt = (r["Autres unités impliquées (si applicable)"] || "").toString().trim();
    const flags = [];

    const map = [
      ["Programme", "Autres unités impliquées (si applicable)/Programme"],
      ["Opérations / Admin-Fin", "Autres unités impliquées (si applicable)/Opérations / Admin-Fin"],
      ["Suivi-Évaluation (M&E)", "Autres unités impliquées (si applicable)/Suivi-Évaluation (M&E)"],
      ["Communication", "Autres unités impliquées (si applicable)/Communication"],
      ["Protection / VBG", "Autres unités impliquées (si applicable)/Protection / VBG"],
      ["Information Management", "Autres unités impliquées (si applicable)/Information Management"],
      ["Achats / Logistique", "Autres unités impliquées (si applicable)/Achats / Logistique"],
      ["Autre", "Autres unités impliquées (si applicable)/Autre"],
    ];

    map.forEach(([label, key]) => {
      const v = r[key];
      if (v === 1 || v === "1" || v === true || v === "true") flags.push(label);
    });

    const out = [];
    if (txt) out.push(txt);
    flags.forEach(f => { if (!out.includes(f)) out.push(f); });
    return out.join("; ");
  }

  function fillSelect(select, values, placeholder){
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  // Remplir filtres depuis champs Kobo (bruts)
  fillSelect(elPilier, uniq(data.map(d => d["Pilier ONU Femmes"])), "Tous les piliers");
  fillSelect(elBureau, uniq(data.map(d => d["Bureau ONU Femmes (RDC)"])), "Tous les bureaux");
  fillSelect(elStatutPlanif, uniq(data.map(d => d["Statut (planificateur)"])), "Tous statuts (planif)");
  fillSelect(elStatutSuivi, uniq(data.map(d => d["Statut de suivi"])), "Tous statuts (suivi)");

  function isOverdue(r){
    const fin = (r["Date de fin"] || "").toString().trim();
    if (!fin) return false;
    const end = new Date(fin);
    if (isNaN(end.getTime())) return false;

    const today = new Date(); today.setHours(0,0,0,0);
    const status = ((r["Statut de suivi"] || r["Statut (planificateur)"] || "") + "").toLowerCase();
    const done = ["clôt","clot","termin","achev","done","completed"].some(s => status.includes(s));
    return end < today && !done;
  }

  function apply() {
    const q = (elQ.value || "").toLowerCase().trim();
    const pilier = elPilier.value || "";
    const bureau = elBureau.value || "";
    const sp = elStatutPlanif.value || "";
    const ss = elStatutSuivi.value || "";
    const from = elFrom.value || "";
    const to = elTo.value || "";
    const scope = elScope.value || "all";

    const filtered = data.filter(r => {
      if (pilier && (r["Pilier ONU Femmes"] || "") !== pilier) return false;
      if (bureau && (r["Bureau ONU Femmes (RDC)"] || "") !== bureau) return false;
      if (sp && (r["Statut (planificateur)"] || "") !== sp) return false;
      if (ss && (r["Statut de suivi"] || "") !== ss) return false;

      const sd = (r["Date de début"] || "").toString();
      if (from && sd && sd < from) return false;
      if (to && sd && sd > to) return false;

      if (scope === "overdue" && !isOverdue(r)) return false;
      if (scope === "withFollowup" && !((r["Commentaire de suivi"] || "").toString().trim())) return false;

      if (!q) return true;

      const blob = [
        r["code_activite"],
        r["Activité (titre court)"],
        r["Type d’activité"],
        r["Pilier ONU Femmes"],
        r["Bureau ONU Femmes (RDC)"],
        r["Statut (planificateur)"],
        r["Statut de suivi"],
        r["Commentaire de suivi"],
        r["Validation"],
        r["Commentaire de validation"],
      ].join(" ").toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) sur ${data.length}`;
  }

  function render(rows) {
    tbody.innerHTML = rows.map(r => {
      const maj = r["date_mise_a_jour"] || r["_submission_time"] || "";
      const overdueClass = isOverdue(r) ? " badge--danger" : "";

      return `
        <tr>
          <td class="strong">${esc(r["code_activite"] || "")}</td>
          <td class="strong">${esc(r["Activité (titre court)"] || "")}</td>
          <td>${esc(r["Type d’activité"] || "")}</td>
          <td>${esc(r["Pilier ONU Femmes"] || "")}</td>
          <td>${esc(r["Bureau ONU Femmes (RDC)"] || "")}</td>
          <td>${esc(units(r))}</td>
          <td>${esc(r["Date de début"] || "")}</td>
          <td>${esc(r["Date de fin"] || "")}</td>
          <td><span class="badge${overdueClass}">${esc(r["Statut (planificateur)"] || "")}</span></td>
          <td>${esc(r["Statut de suivi"] || "")}</td>
          <td>${esc(r["Niveau d’avancement (%)"] || "")}</td>
          <td class="notes">${esc(r["Commentaire de suivi"] || "")}</td>
          <td>${esc(r["Validation"] || "")}</td>
          <td>${esc(maj || "")}</td>
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
