(async function () {
  const data = await fetch("./data/activities.json", { cache: "no-store" }).then(r => r.json());

  const elQ = document.getElementById("q");
  const elPilier = document.getElementById("pilier");
  const elStatut = document.getElementById("statut");
  const elFrom = document.getElementById("from");
  const elTo = document.getElementById("to");
  const elReset = document.getElementById("reset");
  const elMeta = document.getElementById("meta");
  const tbody = document.querySelector("#tbl tbody");

  fillSelect(elPilier, unique(data.map(d => d.pilier)), "Tous les piliers");
  fillSelect(elStatut, unique(data.map(d => d.statut)), "Tous les statuts");

  function apply() {
    const q = (elQ.value || "").toLowerCase().trim();
    const pilier = elPilier.value || "";
    const statut = elStatut.value || "";
    const from = elFrom.value || "";
    const to = elTo.value || "";

    const filtered = data.filter(d => {
      if (pilier && (d.pilier || "") !== pilier) return false;
      if (statut && (d.statut || "") !== statut) return false;

      const sd = (d.date_debut || "");
      if (from && sd && sd < from) return false;
      if (to && sd && sd > to) return false;

      if (!q) return true;

      const blob = [
        d.activite, d.objectif, d.pilier, d.type, d.responsable,
        d.province, d.zone, d.statut, d.notes_suivi
      ].join(" ").toLowerCase();

      return blob.includes(q);
    });

    render(filtered);
    elMeta.textContent = `${filtered.length} activité(s) affichée(s) sur ${data.length}`;
  }

  function render(rows) {
    tbody.innerHTML = rows
      .sort((a,b) => (a.date_debut || "").localeCompare(b.date_debut || ""))
      .map(r => `
        <tr>
          <td class="strong">${escapeHtml(r.activite || "")}</td>
          <td>${escapeHtml(r.pilier || "")}</td>
          <td>${escapeHtml(r.responsable || "")}</td>
          <td>${escapeHtml([r.province, r.zone].filter(Boolean).join(" / "))}</td>
          <td>${escapeHtml(r.date_debut || "")}</td>
          <td>${escapeHtml(r.date_echeance || "")}</td>
          <td><span class="badge">${escapeHtml(r.statut || "")}</span></td>
          <td class="notes">${escapeHtml(r.notes_suivi || "")}</td>
        </tr>
      `)
      .join("");
  }

  [elQ, elPilier, elStatut, elFrom, elTo].forEach(el => el.addEventListener("input", apply));
  elReset.addEventListener("click", () => {
    elQ.value = "";
    elPilier.value = "";
    elStatut.value = "";
    elFrom.value = "";
    elTo.value = "";
    apply();
  });

  apply();
})();
