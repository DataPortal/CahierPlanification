import os
import json
import time
from pathlib import Path

import requests

DEFAULT_BASE_URL = "https://kf.kobotoolbox.org"
DEFAULT_ASSET_UID = "aa3qCQdZPZgaowihPLrpGz"

def require_env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None or str(val).strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return str(val).strip()

def fetch_all_pages(url: str, headers: dict, timeout: int = 120) -> dict:
    """
    Kobo v2 /assets/{uid}/data/ returns a paginated structure:
      {count, next, previous, results:[...]}
    This function follows `next` until completion and returns a consolidated payload.
    """
    session = requests.Session()
    all_results = []
    first_payload = None

    page = 0
    while url:
        page += 1
        resp = session.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()

        if first_payload is None:
            first_payload = payload

        results = payload.get("results")
        if isinstance(results, list):
            all_results.extend(results)
        else:
            # Some configurations can return non-paginated list directly
            if isinstance(payload, list):
                all_results = payload
                first_payload = {"count": len(payload), "next": None, "previous": None, "results": payload}
                break

        url = payload.get("next")  # Kobo provides absolute URL
        time.sleep(0.2)  # polite delay to reduce throttling risk

    # Build consolidated payload
    consolidated = {
        "count": first_payload.get("count") if isinstance(first_payload, dict) else len(all_results),
        "next": None,
        "previous": None,
        "results": all_results,
    }
    return consolidated

def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)

def main() -> None:
    base = require_env("KOBO_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    token = require_env("KOBO_TOKEN")  # no default for token (security)
    asset = require_env("KOBO_ASSET_UID", DEFAULT_ASSET_UID)

    # Endpoint v2 KoboToolbox
    url = f"{base}/api/v2/assets/{asset}/data/?format=json"

    headers = {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
    }

    payload = fetch_all_pages(url=url, headers=headers, timeout=120)

    out_path = Path("data") / "submissions.json"
    atomic_write_json(out_path, payload)

    n = len(payload.get("results", []))
    print(f"Fetched {n} submissions from asset {asset}")
    print(f"Saved to {out_path.as_posix()}")

if __name__ == "__main__":
    main()
