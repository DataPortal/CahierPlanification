import json
from datetime import datetime

INPUT = "data/submissions.json"
OUTPUT = "data/activities.json"

def pick(d, *keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None

def to_iso_date(s):
    if not s or not isinstance(s, str):
        return s
    s = s.strip()
    # Kobo renvoie souvent ISO; on tente une conversion prudente
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except Exception:
        return s

def to_iso_datetime(s):
    if not s or not isinstance(s, str):
        return s
    s = s.strip()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.isoformat()
    except Exception:
        return s

with open(INPUT, "r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw.get("results", [])
out = []

for r in rows:
    act = {
        "record_id": pick(r, "record_id", "_id"),
        "submission_time": to_iso_datetime(pick(r, "_submission_time")),

        # Champs à adapter à votre XLSForm (je garde des clés proches de vos exemples)
        "activite": pick(r, "Activités", "Activite", "activity"),
        "objectif": pick(r, "Objectif", "objectif"),
        "pilier": pick(r, "Piliers", "Pilier", "pillar"),
        "type": pick(r, "Type d'activité", "Type", "type"),
        "responsable": pick(r, "Responsable", "owner"),
        "statut": pick(r, "Statut", "status"),

        "province": pick(r, "Province", "province"),
        "zone": pick(r, "Zone", "zone"),

        "date_debut": to_iso_date(pick(r, "Date de début", "date_debut", "start_date")),
        "date_echeance": to_iso_date(pick(r, "Date d’échéance", "Date d'échéance", "date_echeance", "end_date")),

        "priorite": pick(r, "Priorité", "priorite"),
        "notes_suivi": pick(r, "Suivi/Commentaires", "Suivi", "Commentaires", "notes"),
    }

    out.append(act)

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(out)} submissions into {OUTPUT}")
