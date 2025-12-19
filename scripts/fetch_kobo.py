import os
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any

import requests

DEFAULT_BASE_URL = "https://kf.kobotoolbox.org"
DEFAULT_ASSET_UID = "aa3qCQdZPZgaowihPLrpGz"

# Tuning
DEFAULT_TIMEOUT = 120
PAGE_SLEEP_SECONDS = 0.2
MAX_PAGES_SAFETY = 10000  # évite boucle infinie si API renvoie un next cassé


def require_env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name, default)
    if val is None or str(val).strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return str(val).strip()


def atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def fetch_all_pages(url: str, headers: Dict[str, str], timeout: int = DEFAULT_TIMEOUT) -> Dict[str, Any]:
    """
    Kobo v2 endpoint:
      /api/v2/assets/{uid}/data/?format=json
    Generally returns:
      {count, next, previous, results:[...]}
    This function follows `next` until completion.
    """
    session = requests.Session()

    # Headers additionnels utiles (diagnostic + éviter certains blocages)
    session.headers.update(headers)
    session.headers.setdefault("User-Agent", "UNW-Agenda-Sync/1.0 (+GitHubActions)")

    all_results = []
    first_payload: Optional[Dict[str, Any]] = None

    page = 0
    next_url = url

    while next_url:
        page += 1
        if page > MAX_PAGES_SAFETY:
            raise RuntimeError("Pagination safety limit reached. Check Kobo 'next' URL loop.")

        resp = session.get(next_url, timeout=timeout)

        # Gestion simple des erreurs courantes (rate limit / transient)
        if resp.status_code in (429, 500, 502, 503, 504):
            # backoff basique
            wait = min(10, 1 + page * 0.2)
            print(f"Warning: HTTP {resp.status_code} on page {page}. Retrying in {wait:.1f}s...")
            time.sleep(wait)
            resp = session.get(next_url, timeout=timeout)

        resp.raise_for_status()
        payload = resp.json()

        # Cas inattendu: payload est directement une liste
        if isinstance(payload, list):
            all_results = payload
            first_payload = {"count": len(payload), "next": None, "previous": None, "results": payload}
            break

        if first_payload is None:
            first_payload = payload

        results = payload.get("results", [])
        if not isinstance(results, list):
            results = []

        all_results.extend(results)

        next_url = payload.get("next")  # Kobo fournit une URL absolue ou None
        if next_url:
            time.sleep(PAGE_SLEEP_SECONDS)

    # Consolidated payload (stable pour vos scripts JS/Python)
    consolidated = {
        "count": (first_payload.get("count") if isinstance(first_payload, dict) else None) or len(all_results),
        "next": None,
        "previous": None,
        "results": all_results,
    }

    return consolidated


def main() -> None:
    base = require_env("KOBO_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    token = require_env("KOBO_TOKEN")  # jamais de default (sécurité)
    asset = require_env("KOBO_ASSET_UID", DEFAULT_ASSET_UID)

    url = f"{base}/api/v2/assets/{asset}/data/?format=json"

    headers = {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
    }

    payload = fetch_all_pages(url=url, headers=headers, timeout=DEFAULT_TIMEOUT)

    out_path = Path("data") / "submissions.json"
    atomic_write_json(out_path, payload)

    n = len(payload.get("results", []))
    c = payload.get("count")
    print(f"Fetched submissions: {n} (API count={c}) from asset {asset}")
    print(f"Saved: {out_path.as_posix()}")


if __name__ == "__main__":
    main()
