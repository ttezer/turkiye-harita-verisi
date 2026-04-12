#!/usr/bin/env python

from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from datetime import datetime, UTC
from pathlib import Path


DATASET_ID = "cod-ab-tur"
API_URL = f"https://data.humdata.org/api/3/action/package_show?id={DATASET_ID}"
TARGET_DIR = Path("source/hdx/cod-ab-tur")
USER_AGENT = "Mozilla/5.0"
WANTED_FORMATS = {"GeoJSON", "XLSX"}


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=300) as response:
        return response.read()


def sha256sum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    package = fetch_json(API_URL)["result"]
    selected = [r for r in package.get("resources", []) if r.get("format") in WANTED_FORMATS]

    manifest = {
        "dataset_id": DATASET_ID,
        "title": package.get("title"),
        "license_id": package.get("license_id"),
        "license_title": package.get("license_title"),
        "metadata_modified": package.get("metadata_modified"),
        "fetched_at": datetime.now(UTC).isoformat(),
        "resources": [],
    }

    for resource in selected:
        url = resource["url"]
        filename = os.path.basename(url)
        payload = fetch_bytes(url)
        destination = TARGET_DIR / filename
        destination.write_bytes(payload)
        manifest["resources"].append(
            {
                "name": resource.get("name"),
                "format": resource.get("format"),
                "resource_id": resource.get("id"),
                "url": url,
                "path": destination.as_posix(),
                "sha256": sha256sum(payload),
                "bytes": len(payload),
                "last_modified": resource.get("last_modified"),
            }
        )

    (TARGET_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Fetched {len(selected)} HDX resources into {TARGET_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
