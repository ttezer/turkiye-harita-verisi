# HDX Source

This directory stores vendored HDX snapshots used only for fallback/reference
and legacy id-code compatibility. The default build uses `source/kamu-kaynak`.

Rules:

- never build from live HTTP responses directly
- always download a pinned resource snapshot first
- keep a local `manifest.json` with dataset id, resource id, URL, checksum, and fetch date
- keep original archive files unchanged
- do not commit `extracted/`; it is regenerated from the pinned zip when needed

Expected layout:

```text
source/hdx/
  cod-ab-tur/
    tur_admin_boundaries.geojson.zip
    tur_admin_boundaries.xlsx
    manifest.json
```
