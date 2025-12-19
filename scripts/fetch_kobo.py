import os
import json
import requests

BASE = os.environ["KOBO_BASE_URL"].rstrip("/")
TOKEN = os.environ["KOBO_TOKEN"].strip()
ASSET = os.environ["KOBO_ASSET_UID"].strip()

url = f"{BASE}/api/v2/assets/{ASSET}/data/?format=json"

headers = {"Authorization": f"Token {TOKEN}"}

resp = requests.get(url, headers=headers, timeout=120)
resp.raise_for_status()

data = resp.json()

os.makedirs("data", exist_ok=True)
with open("data/submissions.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Fetched {len(data.get('results', []))} submissions")
