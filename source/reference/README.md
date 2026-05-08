# Reference

This directory stores curated reference tables used to enrich the canonical dataset.

Rules:

- reference files are deterministic local snapshots, not live API fetches
- joins should prefer HDX-based administrative ids
- add only fields that are canonical or validation-relevant
- do not duplicate geometry here

Expected files:

- `provinces.crosswalk.json`
- `districts.crosswalk.json`
- `regions.geographic-7.json`
- `province-municipality-types.json`
- `province-crosswalk.manifest.json`
- `source-labels.json`
- `quality-overrides.json`
- `mahalle-geometry-repairs.json`
- `mahalle-assignment-overrides.json`
- `mahalle-open-data-sources.json`
- `mahalle-open-data-name-overrides.json`

Current policy:

- `source/mulki-idare/` remains validation/reference only
- open-data mahalle source catalogs and manual overrides live here
- passive kamu-reference files do not drive the default build

Quality note policy:

- `quality-overrides.json` is the manual quality note registry for UI-visible warnings
- use `manual_quality_note` for reviewed exceptions or context notes
- use `limited_source_coverage` when an open-data source covers only part of a province or only one district
- generated signals such as OSB areas or geometry repairs come from `data/processed/mahalle-geometrileri-report.json`, not from this directory

Related docs:

- [docs/data-sources.md](/D:/turkiye_map/docs/data-sources.md)
- [docs/pipeline.md](/D:/turkiye_map/docs/pipeline.md)
- [harita-genel-mudurlugu.md](/D:/turkiye_map/source/reference/harita-genel-mudurlugu.md)
