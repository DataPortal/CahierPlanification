import json
from datetime import datetime, date

INPUT = "data/submissions.json"
OUTPUT = "data/activities.json"

# --- helpers ---
def pick(d, *keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None

def as_str(x):
    return "" if x is None else str(x)

def to_iso_date(v):
    """
    Kobo/CSV peut fournir:
    - '2025-12-19'
    - ou vide
    """
    s = as_str(v).strip()
    if not s:
        return ""
    # si déjà AAAA-MM-JJ, on garde
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return s

def to_iso_datetime(v):
    s = as_str(v).strip()
    if not s:
        return ""
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.isoformat()
    except Exception:
        return s

def bool01(v):
    # Kobo export peut rendre 1/0, true/false, "1"/"0"
    if v in (1, "1", True, "true", "True"):
        return 1
    return 0

def normalize_units(r):
    """
    Construit une liste d'unités impliquées à partir des colonnes booléennes:
    Autres unités impliquées (si applicable)/Programme, etc.
    Et aussi le champ texte global "Autres unités impliquées (si applicable)" si rempli.
    """
    units = []

    # champ texte global (ex: "Programme Achats / Logistique")
    txt = as_str(pick(r, "Autres unités impliquées (si applicable)")).strip()
    if txt:
        # on le garde comme "free text" en plus des cases cochées
        units.append(txt)

    # cases à cocher
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

    flags = []
    for label, col in mapping:
        if bool01(pick(r, col)) == 1:
            flags.append(label)

    # dédoublonnage propre
    out = []
    for u in units + flags:
        u = u.strip()
        if u and u not in out:
            out.append(u)

    return out

def compute_overdue(end_date_iso, statut_suivi, statut_planif):
    """
    Overdue si Date de fin < aujourd’hui ET pas terminé.
    On utilise en priorité 'Statut de suivi' si rempli, sinon 'Statut (planificateur)'.
    """
    end_s = (end_date_iso or "").strip()
    if not end_s:
        return 0
    try:
        d_end = date.fromisoformat(end_s[:10])
    except Exception:
        return 0

    status = (statut_suivi or statut_planif or "").strip().lower()
    if not status:
        # si pas de statut, on considère non terminé
        done = False
    else:
        done = any(x in status for x in ["clôt", "clot", "termin", "done", "completed", "achev"])

    if done:
        return 0

    return 1 if d_end < date.today() else 0

# --- main ---
with open(INPUT, "r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw.get("results", [])
activities = []

for r in rows:
    code_activite = pick(r, "code_activite")
    titre = pick(r, "Activité (titre court)")
    type_activite = pick(r, "Type d’activité")
    pilier = pick(r, "Pilier ONU Femmes")
    bureau = pick(r, "Bureau ONU Femmes (RDC)")

    date_debut = to_iso_date(pick(r, "Date de début"))
    date_fin = to_iso_date(pick(r, "Date de fin"))

    responsable = pick(r, "Responsable (nom)")
    statut_planif = pick(r, "Statut (planificateur)")

    statut_suivi = pick(r, "Statut de suivi")
    avancement = pick(r, "Niveau d’avancement (%)")
    commentaire_suivi = pick(r, "Commentaire de suivi")

    validation = pick(r, "Validation")
    commentaire_validation = pick(r, "Commentaire de validation")

    date_mise_a_jour = to_iso_datetime(pick(r, "date_mise_a_jour"))
    submission_time = to_iso_datetime(pick(r, "_submission_time"))

    units = normalize_units(r)

    # sécuriser avancement en nombre si possible
    try:
        avancement_num = float(avancement) if avancement not in (None, "", " ") else None
    except Exception:
        avancement_num = None

    overdue = compute_overdue(date_fin, statut_suivi, statut_planif)

    activities.append({
        "id": pick(r, "_id"),
        "uuid": pick(r, "_uuid"),
        "index": pick(r, "_index"),

        "code_activite": code_activite,
        "titre": titre,
        "type_activite": type_activite,
        "pilier": pilier,
        "bureau": bureau,
        "unites_impliquees": units,

        "date_debut": date_debut,
        "date_fin": date_fin,

        "responsable": responsable,
        "statut_planificateur": statut_planif,

        "statut_suivi": statut_suivi,
        "avancement_pct": avancement_num,
        "commentaire_suivi": commentaire_suivi,

        "validation": validation,
        "commentaire_validation": commentaire_validation,

        "date_mise_a_jour": date_mise_a_jour,
        "submission_time": submission_time,

        "overdue": overdue
    })

# tri simple par date_debut puis code
activities.sort(key=lambda x: (x.get("date_debut") or "", x.get("code_activite") or ""))

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} rows into {OUTPUT}")
