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

def is_non_empty(v) -> bool:
    return v not in (None, "", " ") and as_str(v).strip() != ""

def pick(r: dict, *keys):
    """Retourne le premier champ non vide trouvé parmi keys."""
    for k in keys:
        if k in r and is_non_empty(r[k]):
            return r[k]
    return None

def to_iso_date(v) -> str:
    s = as_str(v).strip()
    if not s:
        return ""
    # Kobo renvoie souvent "2025-12-19" ou "2025-12-19T..."
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

    # Harmonisation légère (vos valeurs: Planifiee / En_cours / Finalisee / Annulee)
    if "annul" in low:
        return "Annulée"
    if "plan" in low:
        return "Planifiée"
    if "final" in low or "clôt" in low or "clot" in low or "termin" in low or "achev" in low:
        return "Finalisée"
    if "cours" in low or "en_cours" in low or "encours" in low:
        return "En cours"
    if "retard" in low:
        return "Retard"

    return t

def normalize_priority(s: str) -> str:
    t = as_str(s).strip()
    if not t:
        return ""
    low = t.lower()

    # Vos valeurs: Faible, Moyenne, Elevee, Critique
    if "criti" in low:
        return "Critique"
    if "élev" in low or "eleve" in low or "haut" in low:
        return "Élevée"
    if "moy" in low:
        return "Moyenne"
    if "faib" in low:
        return "Faible"
    return t

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
    Kobo peut renvoyer: 50, "50", "50.0", "", None
    """
    if v in (None, "", " "):
        return None
    s = as_str(v).strip()
    if not s:
        return None
    try:
        x = float(s.replace(",", "."))
        if x != x:  # NaN
            return None
        return max(0.0, min(100.0, x))
    except Exception:
        return None

def compute_overdue(date_fin_iso: str, statut_suivi: str, statut_planif: str) -> int:
    """
    En retard si date_fin < aujourd’hui ET pas finalisée/annulée.
    """
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
    # =====================================================
    # Planification (Kobo keys réelles)
    # =====================================================
    titre = pick(r,
        "grp_planif/activite_titre",
        "Activité (titre court)",
        "activite_titre"
    )

    objectif = pick(r,
        "grp_planif/objectif",
        "Objectif(s) de l’activité",
        "objectif"
    )

    livrable = pick(r,
        "grp_planif/livrable",
        "Livrable attendu",
        "livrable_attendu"
    )

    type_activite = pick(r,
        "grp_planif/type_activite",
        "Type d’activité",
        "type_activite"
    )

    pilier = pick(r,
        "grp_planif/pilier",
        "Pilier ONU Femmes",
        "pilier"
    )

    code_activite = pick(r,
        "grp_planif/code_activite",
        "code_activite",
        "Code activité"
    )

    bureau = pick(r,
        "grp_planif/bureau",
        "Bureau ONU Femmes (RDC)",
        "bureau"
    )

    risque = pick(r,
        "grp_planif/priorite",        # ✅ clé réelle dans vos soumissions
        "Risque/Priorité",
        "risque_priorite"
    )

    date_debut = to_iso_date(pick(r,
        "grp_planif/date_debut",
        "Date de début",
        "date_debut"
    ))

    date_fin = to_iso_date(pick(r,
        "grp_planif/date_fin",
        "Date de fin",
        "date_fin"
    ))

    responsable = pick(r,
        "grp_planif/responsable",
        "Responsable (nom)",
        "responsable"
    )

    statut_planif_raw = pick(r,
        "grp_planif/statut_planif",
        "Statut (planificateur)",
        "statut_planif"
    )
    statut_planif = normalize_status(statut_planif_raw)

    # =====================================================
    # Suivi (Kobo keys réelles)
    # =====================================================
    statut_suivi_raw = pick(r,
        "grp_suivi/statut_suivi",
        "Statut de suivi",
        "statut_suivi"
    )
    statut_suivi = normalize_status(statut_suivi_raw)

    # Avancement: priorité au calc, sinon taux_avancement
    av_calc_raw = pick(r,
        "grp_suivi/taux_avancement_calc",
        "taux_avancement_calc"
    )
    av_raw = pick(r,
        "grp_suivi/taux_avancement",  # ✅ clé réelle
        "Niveau d’avancement (%)",
        "avancement_pct"
    )

    taux_avancement_calc = parse_pct(av_calc_raw)
    avancement_pct = parse_pct(av_calc_raw if is_non_empty(av_calc_raw) else av_raw)

    commentaire_suivi = pick(r,
        "grp_suivi/commentaire_suivi",
        "Commentaire de suivi",
        "commentaire_suivi"
    )

    validation = pick(r,
        "grp_suivi/validation_pf",
        "Validation",
        "validation"
    ) or extract_validation_label(r)

    commentaire_validation = pick(r,
        "grp_suivi/commentaire_validation",
        "Commentaire de validation",
        "commentaire_validation"
    )

    date_mise_a_jour = to_iso_datetime(pick(r,
        "grp_suivi/date_mise_a_jour",
        "date_mise_a_jour"
    ))

    submission_time = to_iso_datetime(pick(r, "_submission_time"))

    overdue = compute_overdue(date_fin, statut_suivi, statut_planif)

    activities.append({
        # IDs Kobo
        "id": r.get("_id"),
        "uuid": r.get("_uuid"),
        "instance_id": r.get("meta/instanceID") or r.get("meta/rootUuid") or "",

        # timestamps Kobo
        "start": to_iso_datetime(r.get("start")),
        "end": to_iso_datetime(r.get("end")),
        "submission_time": submission_time,

        # Champs normalisés (vos colonnes retenues)
        "code_activite": as_str(code_activite).strip(),
        "bureau": as_str(bureau).strip(),
        "pilier": as_str(pilier).strip(),
        "titre": as_str(titre).strip(),
        "type_activite": as_str(type_activite).strip(),
        "objectif": as_str(objectif).strip(),
        "livrable_attendu": as_str(livrable).strip(),
        "risque_priorite": normalize_priority(risque),

        "date_debut": date_debut,
        "date_fin": date_fin,
        "responsable": as_str(responsable).strip(),

        "statut_planificateur": statut_planif,
        "statut_suivi": statut_suivi,

        "avancement_pct": avancement_pct,              # float 0..100 ou None
        "taux_avancement_calc": taux_avancement_calc,  # float 0..100 ou None

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
