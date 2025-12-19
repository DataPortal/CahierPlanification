import json
from datetime import datetime, date
from pathlib import Path

INPUT = Path("data/submissions.json")
OUTPUT = Path("data/activities.json")

# =========================================================
# Helpers génériques
# =========================================================

def pick(d: dict, *keys):
    """Retourne la première valeur non vide trouvée parmi les clés."""
    for k in keys:
        if k in d and d[k] not in (None, "", " "):
            return d[k]
    return None


def as_str(x) -> str:
    return "" if x is None else str(x)


def to_iso_date(v) -> str:
    """
    Normalise une date Kobo vers AAAA-MM-JJ si possible.
    Accepte:
      - '2025-12-19'
      - '2025-12-19T14:31:31.568+01:00'
    """
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        # fallback: garder les 10 premiers caractères si format proche ISO
        return s[:10]


def to_iso_datetime(v) -> str:
    """Normalise un datetime Kobo vers ISO 8601."""
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except Exception:
        return s


def bool01(v) -> int:
    """Normalise les booléens Kobo en 0/1."""
    return 1 if v in (1, "1", True, "true", "True", "YES", "yes") else 0


# =========================================================
# Normalisation métier
# =========================================================

def normalize_units(r: dict) -> list[str]:
    """
    Construit la liste des unités impliquées à partir :
    - du champ texte global
    - des cases à cocher (1/0)
    """
    units = []

    txt = as_str(pick(r, "Autres unités impliquées (si applicable)")).strip()
    if txt:
        units.append(txt)

    mapping = [
        ("Programme", "Autres unités impliquées (si applicable)/Programme"),
        ("Opérations / Admin-Fin", "Autres unités impliquées (si applicable)/Opérations / Admin-Fin"),
        ("Suivi-Évaluation (M&E)", "Autres unités impliquées (si applicable)/Suivi-Évaluation (M&E)"),
        ("Communication", "Autres unités impliquées (si applicable)/Communication"),
        ("Protection / VBG", "Autres unités impliquées (si applicable)/Protection / VBG"),
        ("Information Management", "Autres unités impliquées (si applicable)/Information Management"),
        ("Achats / Logistique", "Autres unités impliquées (si applicable)/Achats / Logistique"),
        ("Autre", "Autres unités impliquées (si applicable)/Autre"),
    ]

    for label, col in mapping:
        if bool01(pick(r, col)) == 1 and label not in units:
            units.append(label)

    return units


def compute_overdue(date_fin: str, statut_suivi: str, statut_planif: str) -> int:
    """
    Détermine si une activité est en retard :
    - Date de fin < aujourd’hui
    - ET statut non terminé
    """
    if not date_fin:
        return 0

    try:
        d_end = date.fromisoformat(date_fin[:10])
    except Exception:
        return 0

    status = (statut_suivi or statut_planif or "").lower()

    done = any(
        kw in status
        for kw in ("clôt", "clot", "termin", "achev", "done", "completed")
    )

    if done:
        return 0

    return 1 if d_end < date.today() else 0


# =========================================================
# Main
# =========================================================

if not INPUT.exists():
    raise FileNotFoundError(f"Input file not found: {INPUT}")

with INPUT.open("r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw["results"] if isinstance(raw, dict) and "results" in raw else raw
activities = []

for r in rows:
    date_fin = to_iso_date(pick(r, "Date de fin"))

    statut_planif = pick(r, "Statut (planificateur)")
    statut_suivi = pick(r, "Statut de suivi")

    av_raw = pick(r, "Niveau d’avancement (%)")
    try:
        av_pct = float(av_raw) if av_raw not in (None, "", " ") else None
    except Exception:
        av_pct = None

    activity = {
        "id": pick(r, "_id"),
        "uuid": pick(r, "_uuid"),
        "index": pick(r, "_index"),

        "code_activite": pick(r, "code_activite"),
        "titre": pick(r, "Activité (titre court)"),
        "type_activite": pick(r, "Type d’activité"),
        "pilier": pick(r, "Pilier ONU Femmes"),
        "bureau": pick(r, "Bureau ONU Femmes (RDC)"),

        "unites_impliquees": normalize_units(r),

        "date_debut": to_iso_date(pick(r, "Date de début")),
        "date_fin": date_fin,

        "responsable": pick(r, "Responsable (nom)"),

        "statut_planificateur": statut_planif,
        "statut_suivi": statut_suivi,

        "avancement_pct": av_pct,
        "commentaire_suivi": pick(r, "Commentaire de suivi"),

        "validation": pick(r, "Validation"),
        "commentaire_validation": pick(r, "Commentaire de validation"),

        "date_mise_a_jour": to_iso_datetime(pick(r, "date_mise_a_jour")),
        "submission_time": to_iso_datetime(pick(r, "_submission_time")),

        "overdue": compute_overdue(date_fin, statut_suivi, statut_planif),
    }

    activities.append(activity)

# Tri stable : date début puis code activité
activities.sort(
    key=lambda x: (
        x.get("date_debut") or "9999-12-31",
        x.get("code_activite") or "",
    )
)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} submissions → {OUTPUT}")
