import json
from datetime import datetime, date
from pathlib import Path

INPUT = Path("data/submissions.json")
OUTPUT = Path("data/activities.json")

# ----------------------------
# Helpers
# ----------------------------

def as_str(x) -> str:
    return "" if x is None else str(x)

def to_iso_date(v) -> str:
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return s[:10]

def to_iso_datetime(v) -> str:
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except Exception:
        return s

def normalize_status(s: str) -> str:
    """
    Harmonise quelques statuts (optionnel mais utile pour filtres/graphiques).
    """
    t = as_str(s).strip()
    if not t:
        return ""
    low = t.lower()
    if "plan" in low:
        return "Planifiée"
    if "final" in low or "clôt" in low or "clot" in low or "termin" in low:
        return "Finalisée"
    if "cours" in low or "en" in low:
        return "En cours"
    return t  # fallback

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
    done = any(x in status for x in ["final", "clôt", "clot", "termin", "achev", "done", "completed"])
    if done:
        return 0

    return 1 if d_end < date.today() else 0

def extract_validation_label(r: dict) -> str:
    """
    Kobo met parfois la validation dans _validation_status (objet).
    """
    vs = r.get("_validation_status")
    if isinstance(vs, dict):
        # label: "Approved"
        label = vs.get("label") or vs.get("uid")
        return as_str(label).strip()
    return ""

# ----------------------------
# Main
# ----------------------------

if not INPUT.exists():
    raise FileNotFoundError(f"Input file not found: {INPUT}")

with INPUT.open("r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw["results"] if isinstance(raw, dict) and "results" in raw else raw
activities = []

for r in rows:
    # --- Planification ---
    code_activite = r.get("grp_planif/code_activite")
    titre = r.get("grp_planif/activite_titre")
    type_activite = r.get("grp_planif/type_activite")
    pilier = r.get("grp_planif/pilier")
    bureau = r.get("grp_planif/bureau")
    unites_txt = r.get("grp_planif/autres_unites")

    date_debut = to_iso_date(r.get("grp_planif/date_debut"))
    date_fin = to_iso_date(r.get("grp_planif/date_fin"))

    statut_planif_raw = r.get("grp_planif/statut_planif")
    statut_planif = normalize_status(statut_planif_raw)

    # --- Suivi (point focal) ---
    statut_suivi_raw = r.get("grp_suivi/statut_suivi")
    statut_suivi = normalize_status(statut_suivi_raw)

    commentaire_suivi = r.get("grp_suivi/commentaire_suivi")
    date_mise_a_jour = to_iso_datetime(r.get("grp_suivi/date_mise_a_jour"))

    validation = r.get("grp_suivi/validation_pf") or extract_validation_label(r)
    commentaire_validation = r.get("grp_suivi/commentaire_validation")

    # Avancement (%): votre exemple ne le montre pas. On laisse prêt si vous l'ajoutez plus tard.
    av_raw = r.get("grp_suivi/avancement_pct") or r.get("grp_suivi/niveau_avancement") or r.get("grp_suivi/avancement")
    try:
        avancement_pct = float(av_raw) if av_raw not in (None, "", " ") else None
    except Exception:
        avancement_pct = None

    overdue = compute_overdue(date_fin, statut_suivi, statut_planif)

    activities.append({
        # Identifiants Kobo
        "id": r.get("_id"),
        "uuid": r.get("_uuid"),
        "instance_id": r.get("meta/instanceID"),

        # Timestamps Kobo (bruts)
        "start": to_iso_datetime(r.get("start")),
        "end": to_iso_datetime(r.get("end")),
        "submission_time": to_iso_datetime(r.get("_submission_time")),

        # Champs planification (normalisés)
        "code_activite": code_activite,
        "titre": titre,
        "type_activite": type_activite,
        "pilier": pilier,
        "bureau": bureau,
        "unites_impliquees": [as_str(unites_txt).strip()] if as_str(unites_txt).strip() else [],

        "date_debut": date_debut,
        "date_fin": date_fin,
        "statut_planificateur": statut_planif,

        # Champs suivi (normalisés)
        "statut_suivi": statut_suivi,
        "avancement_pct": avancement_pct,
        "commentaire_suivi": commentaire_suivi,

        "validation": validation,
        "commentaire_validation": commentaire_validation,
        "date_mise_a_jour": date_mise_a_jour,

        # Indicateur dérivé
        "overdue": overdue,
    })

# Tri stable : date début puis code activité
activities.sort(key=lambda x: (x.get("date_debut") or "9999-12-31", x.get("code_activite") or ""))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} rows -> {OUTPUT}")
