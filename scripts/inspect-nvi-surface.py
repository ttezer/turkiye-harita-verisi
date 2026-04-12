#!/usr/bin/env python

from __future__ import annotations

import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = ROOT / "source" / "reference" / "nvi-surface-report.json"
BASE_URL = "https://adres.nvi.gov.tr"
PAGES = [
    f"{BASE_URL}/VatandasIslemleri/AdresSorgu",
    f"{BASE_URL}/VatandasIslemleri/AdresGenelSorgu",
    f"{BASE_URL}/VatandasIslemleri/AdresKisiSorgu",
]
BUNDLES = [
    f"{BASE_URL}/bundles/baseJS?v=b3wcgoxUhLBvwdNwcaRFKfz6X3FigOLcjlzQ6ttXbd81",
    f"{BASE_URL}/bundles/utilJS?v=rdtfDHCZlnQbFAXEL-x-APqH79oooBwcA2UB_nT5nXw1",
]
USER_AGENT = "Mozilla/5.0"


def inspect_page(url: str) -> dict:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    links = [
        a.get("href")
        for a in soup.find_all("a")
        if a.get("href") and "/VatandasIslemleri/" in a.get("href")
    ]

    hidden_inputs = [
        {
            "name": inp.get("name"),
            "value_present": bool(inp.get("value")),
        }
        for inp in soup.find_all("input", {"type": "hidden"})
    ]

    return {
        "url": url,
        "status_code": response.status_code,
        "content_type": response.headers.get("content-type"),
        "hidden_input_count": len(hidden_inputs),
        "has_request_verification_token": any(
            inp["name"] == "__RequestVerificationToken" for inp in hidden_inputs
        ),
        "vatandas_links": sorted(set(links)),
        "select_count": len(soup.find_all("select")),
        "form_count": len(soup.find_all("form")),
    }


def inspect_bundle(url: str) -> dict:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    text = response.text
    needles = [
        "Ilce",
        "Mahalle",
        "Sokak",
        "Bina",
        "Daire",
        "kale.ajaxUtil.sendRequest",
        "window.location.replace",
    ]
    return {
        "url": url,
        "status_code": response.status_code,
        "content_length": len(text),
        "hits": {needle: text.find(needle) for needle in needles},
    }


def main() -> int:
    report = {
        "source": "NVI Adres Kayıt Sistemi public surface discovery",
        "pages": [inspect_page(url) for url in PAGES],
        "bundles": [inspect_bundle(url) for url in BUNDLES],
        "decision": "research_only",
        "notes": [
            "Public pages are reachable and expose anti-forgery tokens.",
            "Target pages do not expose district dropdowns in initial HTML.",
            "JS bundles contain district/address component terms, which suggests a client-side flow exists.",
            "No stable public machine-readable district master endpoint has been extracted yet.",
            "Do not feed district tuik_id / icisleri_id / lau_code from NVI until a reproducible request flow is verified.",
        ],
    }

    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
