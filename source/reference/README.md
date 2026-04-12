# Reference

This directory stores curated reference tables used to enrich the canonical HDX-derived dataset.

Rules:

- reference files are deterministic local snapshots, not live API fetches
- joins should prefer `source_hdx_id`; `id` may be used as a fallback once canonical ids are known
- add only fields that are canonical or validation-relevant
- do not duplicate geometry here

Expected files:

- `provinces.crosswalk.json`
- `districts.crosswalk.json`
- optional `regions.geographic-7.json`
- optional `province-crosswalk.manifest.json`
- optional `uab-validation-report.json`
- optional `e-icisleri-provinces.snapshot.json`
- optional `nvi-surface-report.json`

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
- district crosswalk stays sparse until a reliable public reference for district statistical/admin ids is vendored
- `regions.geographic-7.json`, when added, should be treated as a curated historical-reference mapping and should note that it follows the seven geographic regions identified by the First Geography Congress held in Ankara on June 6-21, 1941
- `source/reference/ilce-listesi.xlsx` is treated as validation-only because it contains non-district rows and ambiguous `MERKEZ` rows
- `e-icisleri` extraction is tracked separately and must not feed build outputs until a stable, reproducible extractor is verified
- `adres.nvi.gov.tr` discovery is tracked separately and remains research-only until a public, reproducible district lookup flow is verified
