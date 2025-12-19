/* =========================================================
   Utils communs – Agenda Activités UN Women RDC
   Compatible :
   - index.html (tableau + suivi)
   - dashboard.html (KPIs + graphiques)
   ========================================================= */

/* ---------- STRING & HTML ---------- */

/**
 * Échappe les caractères HTML pour affichage sécurisé
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Normalise une chaîne pour comparaison (recherche, filtres)
 */
function norm(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase();
}

/* ---------- ARRAYS / SELECTS ---------- */

/**
 * Retourne les valeurs uniques non vides d’un tableau
 */
function unique(arr) {
  return Array.from(
    new Set(
      arr
        .filter(v => v !== null && v !== undefined)
        .map(v => String(v).trim())
        .filter(v => v !== "")
    )
  ).sort((a, b) => a.localeCompare(b));
}

/**
 * Remplit un <select> avec des options
 */
function fillSelect(selectEl, values, placeholder) {
  if (!selectEl) return;

  let html = `<option value="">${escapeHtml(placeholder)}</option>`;
  values.forEach(v => {
    html += `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
  });
  selectEl.innerHTML = html;
}

/* ---------- DATES ---------- */

/**
 * Convertit AAAA-MM-JJ → Date (JS)
 */
function parseISODate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Retourne AAAA-MM à partir de AAAA-MM-JJ
 */
function toYearMonth(dateStr) {
  if (!dateStr || dateStr.length < 7) return "Sans date";
  return dateStr.slice(0, 7);
}

/**
 * Test si une activité est en retard
 * (date_fin < aujourd’hui ET pas clôturée)
 */
function isOverdue(item) {
  if (!item || !item.date_fin) return false;

  const end = parseISODate(item.date_fin);
  if (!end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const status =
    norm(item.statut_suivi) || norm(item.statut_planificateur);

  const isDone =
    status.includes("clôt") ||
    status.includes("clot") ||
    status.includes("termin") ||
    status.includes("achev") ||
    status.includes("done") ||
    status.includes("completed");

  return end < today && !isDone;
}

/* ---------- GROUPING & KPIs ---------- */

/**
 * Regroupe et compte des éléments selon une clé
 */
function groupCount(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Moyenne numérique (ex: % avancement)
 */
function average(numbers) {
  const valid = numbers.filter(
    v => typeof v === "number" && !Number.isNaN(v)
  );
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/* ---------- SEARCH ---------- */

/**
 * Recherche plein texte sur un objet activité
 */
function matchSearch(item, query) {
  if (!query) return true;

  const blob = [
    item.code_activite,
    item.titre,
    item.type_activite,
    item.pilier,
    item.bureau,
    (item.unites_impliquees || []).join(" "),
    item.responsable,
    item.statut_planificateur,
    item.statut_suivi,
    item.commentaire_suivi,
    item.validation
  ]
    .join(" ")
    .toLowerCase();

  return blob.includes(query);
}

/* ---------- EXPORT GLOBAL ---------- */
/* (utile si vous souhaitez accéder aux fonctions depuis la console) */
window.utils = {
  escapeHtml,
  norm,
  unique,
  fillSelect,
  parseISODate,
  toYearMonth,
  isOverdue,
  groupCount,
  average,
  matchSearch
};
