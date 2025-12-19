import json
from datetime import datetime

INPUT = "data/submissions.json"
OUTPUT = "data/activities.json"

def pick(d, *keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None

with open(INPUT, "r", encoding="utf-8") as f:
    raw = json.load(f)

rows = raw.get("results", [])
activities = []

for r in rows:
    # Exemples de mapping — A ADAPTER
    act = {
        "record_id": pick(r, "record_id", "_id"),
        "submission_time": pick(r, "_submission_time"),
        "activite": pick(r, "Activités", "Activite", "activity"),
        "objectif": pick(r, "Objectif", "objectif"),
        "pilier": pick(r, "Piliers", "Pilier", "pillar"),
        "type": pick(r, "Type d'activité", "Type", "type"),
        "responsable": pick(r, "Responsable", "owner"),
        "statut": pick(r, "Statut", "status"),
        "province": pick(r, "Province", "province"),
        "zone": pick(r, "Zone", "zone"),
        "date_debut": pick(r, "Date de début", "date_debut", "start_date"),
        "date_echeance": pick(r, "Date d’échéance", "Date d'échéance", "date_echeance", "end_date"),
        "priorite": pick(r, "Priorité", "priorite"),
        "notes_suivi": pick(r, "Suivi/Commentaires", "Suivi", "Commentaires", "notes"),
    }

    # Normalisation simple des dates (optionnel)
    for k in ("date_debut", "date_echeance", "submission_time"):
        v = act.get(k)
        if isinstance(v, str) and v:
            try:
                # garder en ISO AAAA-MM-JJ si possible
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                act[k] = dt.date().isoformat() if k != "submission_time" else dt.isoformat()
            except Exception:
                pass

    activities.append(act)

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(activities, f, ensure_ascii=False, indent=2)

print(f"Transformed {len(activities)} rows into {OUTPUT}")
