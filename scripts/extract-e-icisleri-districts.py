#!/usr/bin/env python

from __future__ import annotations

import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "source" / "mulki-idare" / "e-icisleri-provinces.snapshot.json"
URL = "https://www.e-icisleri.gov.tr/Anasayfa/MulkiIdariBolumleri.aspx"
USER_AGENT = "Mozilla/5.0"


def main() -> int:
    response = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    province_select = soup.find("select", {"id": "ctl00_cph1_CografiBirimControl_DropDownListIl"})
    district_select = soup.find("select", {"id": "ctl00_cph1_CografiBirimControl_DropDownListIlce"})

    provinces = []
    if province_select:
      for option in province_select.find_all("option"):
        value = option.get("value")
        if value and value != "-1":
          provinces.append({
              "value": value,
              "label": option.get_text(strip=True),
          })

    snapshot = {
        "source": "e-icisleri MulkiIdariBolumleri.aspx",
        "url": URL,
        "status": "bootstrap_only",
        "notes": [
            "The public page exposes province dropdown values in HTML.",
            "District extraction requires controlled ASP.NET postback handling and is intentionally not used in the build yet.",
            "Do not treat these values as canonical district crosswalk rows without a verified extractor."
        ],
        "province_option_count": len(provinces),
        "district_select_present": district_select is not None,
        "province_options": provinces,
    }

    OUTPUT_PATH.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
