import os
import json
import requests

BASE = os.environ.get("KOBO_BASE_URL", "https://kf.kobotoolbox.org").rstrip("/")
TOKEN = os.environ["KOBO_TOKEN"].strip()
ASSET = os.environ.get("KOBO_ASSET_UID", "aa3qCQdZPZgaowihPLrpGz").strip()

# Endpoint v2 KoboToolbox (assets/{uid}/data/)
url = f"{BASE}/api/v2/assets/{ASSET}/data/?format=json"

headers = {
    "Authorization": f"Token {TOKEN}",
    "Accept": "application/json",
}

resp = requests.get(url, headers=headers, timeout=120)
resp.raise_for_status()
payload = resp.json()

os.makedirs("data", exist_ok=True)
with open("data/submissions.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Fetched {len(payload.get('results', []))} submissions from {ASSET}")
