# Source

This directory stores vendored raw source files and reference tables.

Recommended layout:

- `source/hdx/` for pinned HDX snapshots
- `source/reference/` for curated crosswalk and validation tables
- optional `source/geoboundaries/` for secondary geometry validation snapshots

Rules:

- raw source files are never edited in place
- every vendored dataset should carry a local manifest with URL, checksum, and fetch date
- all transformations happen under `scripts/`
