# Download Configurator

Bu belge, kullanıcıya gösterilecek seçim akışının güncel ürün davranışını tanımlar.

## Goal

Kullanıcı ilk ekranda:

- hangi formatı istediğini
- hangi kapsamı istediğini
- hangi detay seviyesini istediğini
- hangi alanları istediğini
- görsel formatlar için stil ve çözünürlüğü

seçebilmeli ve aynı panelden neyin bugün hazır olduğunu görebilmelidir.

## First Release Controls

### `format`

İlk ekranda gösterilecek değerler:

- `json`
- `geojson`
- `topojson`
- `csv`
- `xlsx`
- `sql`
- `wkt`
- `kml`
- `kmz`
- `svg`
- `png`
- `pdf`

Durum:

- `json`: available now
- `geojson`: available now
- `topojson`: available now
- `csv`: available now
- `xlsx`: available now
- `sql`: available now
- `wkt`: available now
- `kml`: available now
- `kmz`: available now
- `svg`: available now
- `png`: available now
- `pdf`: planned

## `scope`

İlk ekranda gösterilecek değerler:

- `turkey`
- `region`
- `province`

## `detail`

İlk ekranda gösterilecek değerler:

- `region`
- `province`
- `district`

## `fields`

Alan seçimi şu formatlarda görünür:

- `json`
- `geojson`
- `topojson`
- `csv`
- `xlsx`
- `sql`
- `kml`
- `svg`

## Valid Matrix

### Current practical combinations

- `format=json` + `scope=turkey` + `detail=region|province`
- `format=geojson` + `scope=region|province` + `detail=province|district`
- `format=topojson` + `scope=region` + `detail=province`
- `format=csv|xlsx|sql|wkt|kml` + `scope=region` + `detail=province`
- `format=kmz` + `scope=turkey` + `detail=province`
- `format=svg|png` + `scope=region` + `detail=province`

### Planned combinations

- `format=pdf` + `scope=turkey|region` + `detail=province`

## UI Rules

### Structured data formats

- `json`, `geojson`, `topojson`, `csv`, `xlsx`, `sql`, `wkt`, `kml`
- `fields`: visible where meaningful
- availability badge: `Hazır`

### `svg`

- `style`: visible
- `fields`: visible
- `resolution`: hidden
- availability badge: `Hazır`

### `png`

- `style`: visible
- `resolution`: visible
- `fields`: hidden
- availability badge: `Hazır`

### Planned formats

- `pdf`
- availability badge: `Planlanan`
- download action should stay disabled

## CTA Logic

İlk sürümde buton davranışı:

- hazır formatlarda indirme doğrudan başlar
- planlanan formatlarda buton pasif görünür

## First UI Copy

Durum mesajı kısa ve nettir:

- `JSON hazır. Metadata indirilebilir.`
- `GeoJSON hazır. Geometry indirilebilir.`
- `SVG hazır. Veri bağlanabilir vektör export indirilebilir.`
- `PNG hazır. Sunum amaçlı raster export indirilebilir.`
- `PDF planlanan format.`
