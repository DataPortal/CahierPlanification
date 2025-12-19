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
  // Remplacer sans replaceAll (compat)
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Normalise une chaîne pour comparaison (recherche, filtres)
 */
function norm(value) {
  return (value === null || value === undefined) ? "" : String(value).trim().toLowerCase();
}

/* ---------- ARRAYS / SELECTS ---------- */

/**
 * Retourne les valeurs uniques non vides d’un tableau
 */
function unique(arr) {
  return Array.from(
    new Set(
      (arr || [])
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

  const vals = Array.isArray(values) ? values : [];
  let html = `<option value="">${escapeHtml(placeholder || "")}</option>`;
  vals.forEach(v => {
    html += `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
  });
  selectEl.innerHTML = html;
}

/* ---------- NUMBERS ---------- */

/**
 * Convertit en nombre (ex: "25", "25,5") sinon null
 */
function toNumber(v) {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = norm(v).replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/* ---------- DATES ---------- */

/**
 * Parse une date ISO "YYYY-MM-DD" de façon fiable (sans surprise timezone)
 * Retourne Date ou null
 */
function parseISODate(dateStr) {
  const s = (dateStr || "").toString().trim();
  if (!s) return null;

  // Cas ISO date-only: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d); // local time, stable
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Fallback (datetime)
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Retourne AAAA-MM à partir de AAAA-MM-JJ / datetime
 */
function toYearMonth(dateStr) {
  const s = (dateStr || "").toString().trim();
  if (!s || s.length < 7) return "Sans date";
  // si "YYYY-MM-..." => OK
  if (s[4] === "-" && s[7] === "-") return s.slice(0, 7);
  return "Sans date";
}

/**
 * Test si une activité est en retard :
 * date_fin < aujourd’hui ET pas clôturée/finalisée
 */
function isOverdue(item) {
  if (!item || !item.date_fin) return false;

  const end = parseISODate(item.date_fin);
  if (!end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const status = norm(item.statut_suivi) || norm(item.statut_planificateur);

  const isDone =
    status.includes("clôt") ||
    status.includes("clot") ||
    status.includes("final") ||
    status.includes("termin") ||
    status.includes("achev") ||
    status.includes("done") ||
    status.includes("completed");

  return end < today && !isDone;
}

/* ---------- STATUS UI ---------- */

/**
 * Classe CSS badge selon statut (pour tableau)
 * Nécessite .badge--success/.badge--info/.badge--warning/.badge--danger dans CSS
 */
function statusClass(statut, overdueFlag) {
  if (overdueFlag) return "badge--danger";
  const s = norm(statut);
  if (!s) return "";
  if (s.includes("final") || s.includes("clôt") || s.includes("termin") || s.includes("achev")) return "badge--success";
  if (s.includes("plan")) return "badge--info";
  if (s.includes("cours") || s.includes("en ")) return "badge--warning";
  return "";
}

/* ---------- GROUPING & KPIs ---------- */

/**
 * Regroupe et compte des éléments selon une clé
 */
function groupCount(array, keyFn, emptyLabel) {
  const label = emptyLabel || "Non renseigné";
  return (array || []).reduce((acc, item) => {
    let key = keyFn(item);
    key = (key === null || key === undefined || String(key).trim() === "") ? label : String(key).trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Moyenne numérique (ex: % avancement)
 */
function average(numbers) {
  const valid = (numbers || []).filter(v => typeof v === "number" && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/* ---------- SEARCH ---------- */

/**
 * Recherche plein texte sur un objet activité (activities.json normalisé)
 */
function matchSearch(item, query) {
  const q = norm(query);
  if (!q) return true;

  const blob = [
    item && item.code_activite,
    item && item.titre,
    item && item.type_activite,
    item && item.pilier,
    item && item.bureau,
    item && (item.unites_impliquees || []).join(" "),
    item && item.responsable,
    item && item.statut_planificateur,
    item && item.statut_suivi,
    item && item.commentaire_suivi,
    item && item.validation,
    item && item.commentaire_validation
  ]
    .map(v => (v === null || v === undefined) ? "" : String(v))
    .join(" ")
    .toLowerCase();

  return blob.includes(q);
}

/* ---------- EXPORT GLOBAL ---------- */
window.utils = {
  escapeHtml,
  norm,
  unique,
  fillSelect,
  toNumber,
  parseISODate,
  toYearMonth,
  isOverdue,
  statusClass,
  groupCount,
  average,
  matchSearch
};
