# Reference

This directory stores curated reference tables used to enrich the canonical dataset.

Rules:

- reference files are deterministic local snapshots, not live API fetches
- joins should prefer `source_hdx_id`; this field is retained as a legacy compatibility key even when the default geometry source is `source/kamu-kaynak/`
- add only fields that are canonical or validation-relevant
- do not duplicate geometry here

Expected files:

- `provinces.crosswalk.json`
- `districts.crosswalk.json`
- optional `regions.geographic-7.json`
- optional `province-municipality-types.json`
- optional `province-crosswalk.manifest.json`
- optional `uab-validation-report.json`
- optional `nvi-surface-report.json`
- optional `legacy-mahalle-sources.json`
- optional `legacy-mahalle-name-overrides.json`
- optional `source-labels.json`
- optional `quality-overrides.json`

Suggested record shape:

```json
[
  {
    "source_hdx_id": "TUR006",
    "id": "TR-P-06",
    "nuts_code": "TR510",
    "tuik_id": "6",
    "icisleri_id": "6",
    "osm_relation_id": 223474,
    "aliases": []
  }
]
```

Current policy:

- province crosswalk may safely populate `iso_3166_2`, `nuts_code`, and province-level `tuik_id`
- `province-municipality-types.json` classifies provinces as `buyuksehir_belediyesi` or `il_belediyesi`; this is used for settlement geometry quality triage because non-metropolitan provinces may contain belde/belediye boundary polygons
- district crosswalk stays sparse until a reliable public reference for district statistical/admin ids is vendored
- `regions.geographic-7.json`, when added, should be treated as a curated historical-reference mapping and should note that it follows the seven geographic regions identified by the First Geography Congress held in Ankara on June 6-21, 1941
- `source/reference/ilce-listesi.xlsx` is treated as validation-only because it contains non-district rows and ambiguous `MERKEZ` rows
- `e-icisleri` / Mulki Idare raw snapshots live under `source/mulki-idare/`
- legacy belediye/kent rehberi mahalle source catalogs and old name overrides live here; active geometry comes from `source/kamu-kaynak/yerlesim`
- visible source labels should use `source_label` values such as `Kamuya açık kaynaklar`; keep the raw `source_name`, `source_url` and `accessed_at` fields for traceability
- `adres.nvi.gov.tr` discovery is tracked separately and remains research-only until a public, reproducible district lookup flow is verified
