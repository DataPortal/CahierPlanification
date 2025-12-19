import json
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, Optional, List

INPUT = Path("data/submissions.json")
OUTPUT = Path("data/activities.json")


# ----------------------------
# Helpers
# ----------------------------
def as_str(x: Any) -> str:
    return "" if x is None else str(x)


def pick(r: Dict[str, Any], *keys: str) -> Any:
    """Return first non-empty value for provided keys."""
    for k in keys:
        if k in r:
            v = r.get(k)
            if v not in (None, "", " "):
                return v
    return None


def to_iso_date(v: Any) -> str:
    """
    Kobo can provide:
      - '2025-12-19'
      - '2025-12-19T14:31:31.568+01:00'
      - '...Z'
    We return 'YYYY-MM-DD' or ''.
    """
    s = as_str(v).strip()
    if not s:
        return ""
    # If already ISO date
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        # handle datetime by slicing
        return s[:10]
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return s[:10]


def to_iso_datetime(v: Any) -> str:
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except Exception:
        return s


def normalize_status(s: Any) -> str:
    """
    Harmonise quelques statuts pour filtres/graphiques.
    Vous pouvez ajuster selon vos valeurs réelles Kobo.
    """
    t = as_str(s).strip()
    if not t:
        return ""
    low = t.lower()

    # Normalisations FR/variantes
    if "plan" in low:
        return "Planifiée"
    if "final" in low or "clôt" in low or "clot" in low or "termin" in low or "achev" in low:
        return "Finalisée"
    if "cours" in low or "en cours" in low:
        return "En cours"

    return t


def bool01(v: Any) -> int:
    if v in (1, "1", True, "true", "True", "yes", "Yes", "oui", "Oui"):
        return 1
    return 0


def compute_overdue(date_fin_iso: str, statut_suivi: str, statut_planif: str) -> int:
    """
    En retard si date_fin < aujourd’hui ET pas finalisée/terminée.
    """
    if not date_fin_iso:
        return 0
    try:
        d_end = date.fromisoformat(date_fin_iso[:10])
    except Exception:
        return 0

    status = (statut_suivi or statut_planif or "").lower()
    done = any(x in status for x in ["final", "clôt", "clot", "termin", "achev", "done", "completed", "close"])
    if done:
        return 0

    return 1 if d_end < date.today() else 0


def extract_validation_label(r: Dict[str, Any]) -> str:
    """
    Kobo met parfois la validation dans _validation_status (objet).
    Ex: {"uid":"validation_status_approved","label":"Approved", ...}
    """
    vs = r.get("_validation_status")
    if isinstance(vs, dict):
        label = vs.get("label") or vs.get("uid") or ""
        return as_str(label).strip()
    return ""


def normalize_units(unites_txt: str, programme_flag: int) -> List[str]:
    """
    Option A:
      - on garde "Autres unités impliquées (texte)" comme élément principal
      - si programme_flag == 1, on ajoute "Programme" (sans dupliquer)
    """
    out: List[str] = []
    txt = as_str(unites_txt).strip()
    if txt:
        out.append(txt)

    if programme_flag == 1 and "Programme" not in out:
        out.append("Programme")

    # dédoublonnage propre
    uniq = []
    for u in out:
        u = u.strip()
        if u and u not in uniq:
            uniq.append(u)
    return uniq


# ----------------------------
# Main
# ----------------------------
if not INPUT.exists():
    raise FileNotFoundError(f"Input file not found: {INPUT}")

with INPUT.open("r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw["results"] if isinstance(raw, dict) and "results" in raw else raw
if not isinstance(rows, list):
    raise ValueError("submissions.json must be a list or a dict with a 'results' list")

activities: List[Dict[str, Any]] = []

for r in rows:
    if not isinstance(r, dict):
        continue

    # =========================
    # Champs retenus (depuis Kobo)
    # =========================
    # 1) Planification
    code_activite = pick(r, "grp_planif/code_activite", "code_activite")
    titre = pick(r, "grp_planif/activite_titre", "Activité (titre court)")
    type_activite = pick(r, "grp_planif/type_activite", "Type d’activité")
    pilier = pick(r, "grp_planif/pilier", "Pilier ONU Femmes")
    bureau = pick(r, "grp_planif/bureau", "Bureau ONU Femmes (RDC)")

    # Autres unités: texte
    autres_unites = pick(r, "grp_planif/autres_unites", "Autres unités impliquées (si applicable)") or ""

    # Programme (checkbox 0/1) - dépend si votre Kobo le renvoie réellement
    programme_flag = bool01(pick(r, "Autres unités impliquées (si applicable)/Programme",
                                 "grp_planif/programme", "programme"))

    date_debut = to_iso_date(pick(r, "grp_planif/date_debut", "Date de début"))
    date_fin = to_iso_date(pick(r, "grp_planif/date_fin", "Date de fin"))

    responsable = pick(r, "Responsable (nom)", "grp_planif/responsable", "responsable")

    statut_planif_raw = pick(r, "grp_planif/statut_planif", "Statut (planificateur)")
    statut_planificateur = normalize_status(statut_planif_raw)

    # 2) Suivi
    statut_suivi_raw = pick(r, "grp_suivi/statut_suivi", "Statut de suivi")
    statut_suivi = normalize_status(statut_suivi_raw)

    commentaire_suivi = pick(r, "grp_suivi/commentaire_suivi", "Commentaire de suivi")

    # Avancement (%)
    av_raw = pick(
        r,
        "grp_suivi/avancement_pct",
        "grp_suivi/niveau_avancement",
        "grp_suivi/avancement",
        "Niveau d’avancement (%)",
    )
    try:
        avancement_pct: Optional[float] = float(av_raw) if av_raw not in (None, "", " ") else None
    except Exception:
        avancement_pct = None

    # Validation
    validation = pick(r, "grp_suivi/validation_pf", "Validation") or extract_validation_label(r)
    commentaire_validation = pick(r, "grp_suivi/commentaire_validation", "Commentaire de validation")

    date_mise_a_jour = to_iso_datetime(pick(r, "grp_suivi/date_mise_a_jour", "date_mise_a_jour"))

    # =========================
    # Dérivés + normalisations
    # =========================
    overdue = compute_overdue(date_fin, statut_suivi, statut_planificateur)

    unites_impliquees = normalize_units(autres_unites, programme_flag)

    # =========================
    # Construction JSON normalisé (Option A)
    # =========================
    activities.append({
        # Identifiants Kobo
        "id": r.get("_id"),
        "uuid": r.get("_uuid"),
        "instance_id": r.get("meta/instanceID"),

        # Timestamps Kobo
        "start": to_iso_datetime(r.get("start")),
        "end": to_iso_datetime(r.get("end")),
        "submission_time": to_iso_datetime(r.get("_submission_time")),

        # Champs retenus (normalisés)
        "code_activite": as_str(code_activite).strip() or None,
        "titre": as_str(titre).strip() or None,
        "type_activite": as_str(type_activite).strip() or None,
        "pilier": as_str(pilier).strip() or None,
        "bureau": as_str(bureau).strip() or None,

        "autres_unites": as_str(autres_unites).strip() or "",
        "programme": programme_flag,  # 0/1
        "unites_impliquees": unites_impliquees,  # liste (texte + flag)

        "date_debut": date_debut,
        "date_fin": date_fin,
        "responsable": as_str(responsable).strip() or None,

        "statut_planificateur": as_str(statut_planificateur).strip() or None,
        "statut_suivi": as_str(statut_suivi).strip() or None,
        "avancement_pct": avancement_pct,
        "commentaire_suivi": as_str(commentaire_suivi).strip() or None,

        "validation": as_str(validation).strip() or None,
        "commentaire_validation": as_str(commentaire_validation).strip() or None,
        "date_mise_a_jour": date_mise_a_jour,

        # Indicateur dérivé
        "overdue": overdue,
    })

# Tri stable : date_debut (vide -> fin) puis code
def sort_key(x: Dict[str, Any]):
    dd = x.get("date_debut") or "9999-12-31"
    cc = x.get("code_activite") or ""
    return (dd, cc)

activities.sort(key=sort_key)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} rows -> {OUTPUT.as_posix()}")
