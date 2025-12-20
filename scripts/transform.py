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

def pick(r: dict, *keys):
    """Retourne le premier champ non vide trouvé."""
    for k in keys:
        if k in r and r[k] not in (None, "", " "):
            return r[k]
    return None

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
    t = as_str(s).strip()
    if not t:
        return ""
    low = t.lower()

    # Harmonisation légère
    if "annul" in low:
        return "Annulée"
    if "plan" in low:
        return "Planifiée"
    if "final" in low or "clôt" in low or "clot" in low or "termin" in low or "achev" in low:
        return "Finalisée"
    if "cours" in low:
        return "En cours"

    return t

def normalize_priority(s: str) -> str:
    t = as_str(s).strip()
    if not t:
        return ""
    low = t.lower()
    if "criti" in low:
        return "Critique"
    if "élev" in low or "eleve" in low:
        return "Élevée"
    if "moy" in low:
        return "Moyenne"
    if "faib" in low:
        return "Faible"
    return t

def compute_overdue(date_fin_iso: str, statut_suivi: str, statut_planif: str) -> int:
    if not date_fin_iso:
        return 0
    try:
        d_end = date.fromisoformat(date_fin_iso[:10])
    except Exception:
        return 0

    status = (statut_suivi or statut_planif or "").lower()
    done = any(x in status for x in ["final", "clôt", "clot", "termin", "achev", "done", "completed", "annul"])
    if done:
        return 0

    return 1 if d_end < date.today() else 0

def extract_validation_label(r: dict) -> str:
    """
    Kobo peut mettre la validation dans _validation_status (objet).
    """
    vs = r.get("_validation_status")
    if isinstance(vs, dict):
        label = vs.get("label") or vs.get("uid")
        return as_str(label).strip()
    return ""

def parse_pct(v):
    """
    Priorité: taux_avancement_calc, sinon Niveau d’avancement (%).
    Kobo peut renvoyer: 50, "50", "50.0", "", None
    """
    if v in (None, "", " "):
        return None
    try:
        x = float(v)
        if x != x:  # NaN
            return None
        return max(0.0, min(100.0, x))
    except Exception:
        return None

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
    # ---------- Champs "nouvelle version" (flat) ----------
    titre = pick(r, "Activité (titre court)", "activite_titre", "grp_planif/activite_titre")
    objectif = pick(r, "Objectif(s) de l’activité", "objectifs_activite", "grp_planif/objectifs_activite")
    livrable = pick(r, "Livrable attendu", "livrable_attendu", "grp_planif/livrable_attendu")

    type_activite = pick(r, "Type d’activité", "type_activite", "grp_planif/type_activite")
    pilier = pick(r, "Pilier ONU Femmes", "pilier", "grp_planif/pilier")

    code_activite = pick(r, "code_activite", "Code activité", "grp_planif/code_activite")
    bureau = pick(r, "Bureau ONU Femmes (RDC)", "bureau", "grp_planif/bureau")

    risque = pick(r, "Risque/Priorité", "risque_priorite", "grp_planif/risque_priorite")

    date_debut = to_iso_date(pick(r, "Date de début", "date_debut", "grp_planif/date_debut"))
    date_fin = to_iso_date(pick(r, "Date de fin", "date_fin", "grp_planif/date_fin"))

    responsable = pick(r, "Responsable (nom)", "responsable", "grp_planif/responsable")

    statut_planif = normalize_status(pick(r, "Statut (planificateur)", "statut_planif", "grp_planif/statut_planif"))
    statut_suivi = normalize_status(pick(r, "Statut de suivi", "statut_suivi", "grp_suivi/statut_suivi"))

    # Avancement: priorité au calcul
    av_calc = pick(r, "taux_avancement_calc", "Taux avancement calc", "grp_suivi/taux_avancement_calc")
    av_raw = pick(r, "Niveau d’avancement (%)", "niveau_avancement", "grp_suivi/niveau_avancement", "grp_suivi/avancement_pct", "grp_suivi/avancement")
    avancement_pct = parse_pct(av_calc if av_calc not in (None, "", " ") else av_raw)

    commentaire_suivi = pick(r, "Commentaire de suivi", "commentaire_suivi", "grp_suivi/commentaire_suivi")
    commentaire_validation = pick(r, "Commentaire de validation", "commentaire_validation", "grp_suivi/commentaire_validation")

    # Validation: champ direct ou validation PF
    validation = pick(r, "Validation", "validation", "grp_suivi/validation_pf") or extract_validation_label(r)

    date_mise_a_jour = to_iso_datetime(pick(r, "date_mise_a_jour", "grp_suivi/date_mise_a_jour"))
    submission_time = to_iso_datetime(pick(r, "_submission_time"))

    overdue = compute_overdue(date_fin, statut_suivi, statut_planif)

    activities.append({
        # IDs Kobo
        "id": r.get("_id"),
        "uuid": r.get("_uuid"),
        "instance_id": r.get("meta/instanceID"),

        # timestamps Kobo
        "start": to_iso_datetime(r.get("start")),
        "end": to_iso_datetime(r.get("end")),
        "submission_time": submission_time,

        # Champs normalisés
        "code_activite": as_str(code_activite).strip(),
        "titre": as_str(titre).strip(),
        "objectif": as_str(objectif).strip(),
        "livrable_attendu": as_str(livrable).strip(),
        "type_activite": as_str(type_activite).strip(),
        "pilier": as_str(pilier).strip(),
        "bureau": as_str(bureau).strip(),
        "risque_priorite": normalize_priority(risque),

        "date_debut": date_debut,
        "date_fin": date_fin,
        "responsable": as_str(responsable).strip(),

        "statut_planificateur": statut_planif,
        "statut_suivi": statut_suivi,

        "avancement_pct": avancement_pct,          # float 0..100 ou None
        "taux_avancement_calc": parse_pct(av_calc), # conserve si vous l’affichez
        "commentaire_suivi": as_str(commentaire_suivi).strip(),

        "validation": as_str(validation).strip(),
        "commentaire_validation": as_str(commentaire_validation).strip(),
        "date_mise_a_jour": date_mise_a_jour,

        # Indicateur dérivé
        "overdue": overdue,
    })

# Tri stable : date début puis code
activities.sort(key=lambda x: (x.get("date_debut") or "9999-12-31", x.get("code_activite") or ""))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} rows -> {OUTPUT}")
