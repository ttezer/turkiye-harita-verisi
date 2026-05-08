# Scripts

Pipeline steps:

1. `fetch-hdx.py`
   Downloads and vendors the selected HDX snapshot into `source/hdx/cod-ab-tur/`.
2. `generate-province-crosswalk.py`
   Generates the province-level reference crosswalk from vendored machine-readable reference data.
3. `inspect-uab-districts.py`
   Produces a validation report for the UAB district workbook without feeding canonical build outputs.
4. `extract-e-icisleri-districts.py`
   Creates a bootstrap snapshot from the public `e-icisleri` page for future controlled extractor work.
5. `inspect-nvi-surface.py`
   Records public-surface discovery findings for the NVI address system without feeding canonical outputs.
6. `normalize.js`
   Normalizes il and ilce fields into the canonical partial metadata model. Default build input is `hdx`.
7. `assign-ids.js`
   Produces deterministic canonical ids from normalized data and attaches region membership.
8. `validate.js`
   Runs schema and relationship validation for region, province, and district outputs.
9. `normalize-mahalle-geometrileri.js`
   Builds mahalle geometries from open-data sources and user-supplied inputs.
   Also writes `data/processed/mahalle-geometrileri-report.json`, which feeds generated UI quality notes such as `osb_area`, `geometry_repair`, and `far_multipolygon`.
10. `export.js`
    Writes consumer-facing outputs into `dist/`.
11. `smoke-test.js`
    Verifies built artifacts, JavaScript package access, static test UI serving, and traversal blocking.

Related quality-note inputs:

- `source/reference/quality-overrides.json`
  Manual quality and coverage notes consumed by the UI.
- `data/processed/mahalle-geometrileri-report.json`
  Generated quality and coverage signals emitted by `normalize-mahalle-geometrileri.js`.
