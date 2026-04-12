#!/usr/bin/env python

from __future__ import annotations

import io
import json
import re
import unicodedata
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parent.parent
HDX_PROVINCES_PATH = ROOT / "data" / "normalized" / "provinces.metadata.partial.json"
REFERENCE_DIR = ROOT / "source" / "reference"
PROVINCE_CROSSWALK_PATH = REFERENCE_DIR / "provinces.crosswalk.json"
MANIFEST_PATH = REFERENCE_DIR / "province-crosswalk.manifest.json"
NUTS_URL = "https://gisco-services.ec.europa.eu/distribution/v2/nuts/download/ref-nuts-2024-01m.geojson.zip"
NUTS_MEMBER = "NUTS_RG_01M_2024_4326_LEVL_3.geojson"
USER_AGENT = "Mozilla/5.0"


def normalize_name(value: str) -> str:
    value = (
        value.replace("\u0130", "i")
        .replace("I", "i")
        .replace("\u0131", "i")
        .replace("\u00c7", "c")
        .replace("\u00e7", "c")
        .replace("\u011e", "g")
        .replace("\u011f", "g")
        .replace("\u00d6", "o")
        .replace("\u00f6", "o")
        .replace("\u015e", "s")
        .replace("\u015f", "s")
        .replace("\u00dc", "u")
        .replace("\u00fc", "u")
    )
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value


def plate_code_from_hdx_pcode(pcode: str) -> str:
    return str(int(pcode[-3:])).zfill(2)


def fetch_nuts_rows() -> list[dict]:
    response = requests.get(NUTS_URL, headers={"User-Agent": USER_AGENT}, timeout=180)
    response.raise_for_status()
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    with archive.open(NUTS_MEMBER) as handle:
        data = json.load(handle)
    return [
        feature["properties"]
        for feature in data["features"]
        if feature["properties"].get("CNTR_CODE") == "TR"
    ]


def load_hdx_provinces() -> list[dict]:
    return json.loads(HDX_PROVINCES_PATH.read_text(encoding="utf-8"))


def build_crosswalk(hdx_provinces: list[dict], nuts_rows: list[dict]) -> list[dict]:
    nuts_by_name = {normalize_name(row["NUTS_NAME"]): row for row in nuts_rows}
    crosswalk = []

    for province in hdx_provinces:
        plate_code = plate_code_from_hdx_pcode(province["source_hdx_id"])
        province_id = f"TR-P-{plate_code}"
        lookup_key = normalize_name(province["name"])
        nuts_row = nuts_by_name.get(lookup_key)
        if nuts_row is None:
            raise RuntimeError(f"Missing NUTS row for province {province['name']}")

        crosswalk.append(
            {
                "source_hdx_id": province["source_hdx_id"],
                "id": province_id,
                "plate_code": plate_code,
                "iso_3166_2": f"TR-{plate_code}",
                "nuts_code": nuts_row["NUTS_ID"],
                "tuik_id": plate_code,
                "icisleri_id": None,
                "osm_relation_id": None,
                "aliases": [],
                "source": {
                    "nuts_name": nuts_row["NUTS_NAME"],
                    "nuts_year": 2024,
                    "nuts_url": NUTS_URL,
                },
            }
        )

    return sorted(crosswalk, key=lambda item: item["id"])


def write_outputs(crosswalk: list[dict], nuts_rows: list[dict]) -> None:
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    PROVINCE_CROSSWALK_PATH.write_text(
        json.dumps(crosswalk, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(UTC).isoformat(),
                "generator": "scripts/generate-province-crosswalk.py",
                "sources": [
                    {
                        "name": "GISCO NUTS 2024 level 3",
                        "url": NUTS_URL,
                        "member": NUTS_MEMBER,
                        "country_code": "TR",
                        "row_count": len(nuts_rows),
                    }
                ],
                "notes": [
                    "plate_code is derived from HDX adm1_pcode suffix",
                    "tuik_id is set equal to province plate_code / il kayit no as a pragmatic province-level alias",
                    "icisleri_id and osm_relation_id remain null until a reliable reference source is vendored",
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    hdx_provinces = load_hdx_provinces()
    nuts_rows = fetch_nuts_rows()
    crosswalk = build_crosswalk(hdx_provinces, nuts_rows)
    write_outputs(crosswalk, nuts_rows)
    print(f"Generated province crosswalk rows: {len(crosswalk)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
