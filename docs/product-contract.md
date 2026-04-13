# Product Contract

Bu belge, projenin veri altyapısından kullanıcıya sunulacak harita çıktısı katmanına geçerken kullanacağı ürün sözleşmesini tanımlar.

## Product Goal

Projenin çekirdek amacı:

- Türkiye'nin il ve ilçe sınırlarını güvenilir ve tekrar üretilebilir biçimde sunmak
- bu verileri geliştirici dostu formatlarda yayınlamak
- zamanla bu verilerden seçilebilir harita çıktıları üretmek

Bu projede "harita" iki ayrı katmanda ele alınır:

1. veri çıktısı
2. render edilmiş harita çıktısı

## Core Output Types

### Data Outputs

- `json`
- `geojson`

### Rendered Outputs

- `svg`
- `png`
- `pdf`
- `kml`
- `kmz`
- `shp`

Notlar:

- `json` metadata merkezlidir
- `geojson` geometri merkezlidir
- `svg` veri bağlanabilir vektör asset olarak düşünülür
- `png` ve `pdf` sunum / paylaşım / baskı odaklıdır
- `kml`, `kmz`, `shp` zengin format hedefidir
  - **Mevcut Durum:** KML/KMZ ve SHP üretimi aktiftir. KML/KMZ tarayıcıda filtreli üretilir; SHP `dist/shp/` altında ZIP paketi olarak statik üretilir.
## User-Selectable Parameters

İlk sözleşmede kullanıcı açısından temel parametreler:

- `format`
- `scope`
- `detail`
- `style`
- `resolution`

İkinci halka parametreler:

- `fields`
- `include_labels`
- `label_field`
- `include_metadata`
- `simplification`

## `format`

Kullanıcı, hangi çıktı türünü almak istediğini seçer.

Desteklenen değerler:

- `json`
- `geojson`
- `svg`
- `png`
- `pdf`
- `kml`
- `kmz`
- `shp`

### Meaning

- `json`
  - metadata çıktısı
  - geometri içermez
- `geojson`
  - geometry + properties çıktısı
- `svg`
  - veri bağlanabilir vektör harita çıktısı
- `png`
  - raster harita çıktısı
- `pdf`
  - baskı ve doküman çıktısı
- `kml`
  - coğrafi paylaşım / Earth uyumlu çıktı
- `kmz`
  - sıkıştırılmış `kml`
- `shp`
  - GIS araçları için shapefile ailesi

### Mevcut Üretim Kapsamı

Aktif olarak üretilen formatlar:

- `json` — metadata çıktısı
- `geojson` — geometri + properties
- `topojson` — topoloji tabanlı sıkıştırılmış geometri
- `csv` — tabular data, UTF-8 BOM ile
- `xlsx` — Excel çoklu sayfa çıktısı (bölge / il / ilçe)
- `sql` — SQLite uyumlu INSERT script
- `wkt` — Well-Known Text geometri listesi
- `kml` — Google Earth / coğrafi paylaşım
- `kmz` — sıkıştırılmış KML
- `svg` — veri bağlanabilir vektör harita
- `png` — raster harita (seçilebilir çözünürlük)

Planlanan ama henüz üretilmeyen formatlar:

- `pdf`

## `scope`

Kullanıcı, hangi coğrafi kapsamın üretileceğini seçer.

Desteklenen değerler:

- `turkey`
- `region`
- `province`

### Meaning

- `turkey`
  - tüm Türkiye
- `region`
  - seçili NUTS-1 bölgesi
- `province`
  - seçili il ve altındaki ilçeler

## `detail`

Kullanıcı, seçilen kapsam içinde hangi idari kırılım seviyesini istediğini seçer.

Desteklenen değerler:

- `region`
- `province`
- `district`

### Meaning

- `province`
  - il sınırları
- `district`
  - ilçe sınırları

### Valid Combinations

İlk sürüm için mantıklı kombinasyonlar:

- `scope=turkey` + `detail=province`
- `scope=province` + `detail=district`

Şimdilik desteklenmeyen veya ertelenen kombinasyonlar:

- `scope=turkey` + `detail=district`
- `scope=province` + `detail=province`

## `style`

`style`, yalnızca görsel çıktı formatlarında anlamlıdır.

Bu yüzden:

- `json` için `style` uygulanmaz
- `geojson` için `style` uygulanmaz
- `svg`, `png`, `pdf`, gerekirse `kml` için anlamlıdır

Olası değerler:

- `filled`
- `outline-only`
- `light`
- `dark`
- `labeled`

Karar:

- `style`, `format` ile bağlı parametredir
- veri formatlarında görünmez veya devre dışı kalır

### Style Definitions

#### `filled`

Amaç:

- standart tematik harita görünümü
- sınırlar görünür, alan dolgusu aktiftir

Beklenen davranış:

- polygon fill açık
- border görünür
- label opsiyoneldir

Uygun formatlar:

- `svg`
- `png`
- `pdf`

#### `outline-only`

Amaç:

- sade sınır çizimi
- arka planla birleşebilen hafif harita asset'i

Beklenen davranış:

- fill kapalı veya şeffaf
- stroke esas görsel ögedir
- label opsiyoneldir

Uygun formatlar:

- `svg`
- `png`
- `pdf`

#### `light`

Amaç:

- açık zeminli, sunum ve doküman dostu tema

Beklenen davranış:

- açık arka plan
- koyu sınırlar
- okunaklı label kontrastı

Uygun formatlar:

- `svg`
- `png`
- `pdf`

#### `dark`

Amaç:

- koyu UI'lar, dashboard ve sunum yüzeyleri için tema

Beklenen davranış:

- koyu arka plan
- açık kontur ve yazı
- glow veya neon türevleri opsiyonel olabilir

Uygun formatlar:

- `svg`
- `png`
- `pdf`

#### `labeled`

Amaç:

- geometri ile birlikte doğrudan etiket taşımak

Beklenen davranış:

- `include_labels=true` varsayılır
- `label_field` belirtilmemişse `name` kullanılır

Uygun formatlar:

- `svg`
- `png`
- `pdf`

### Style Presets

İlk sürüm için önerilen preset yaklaşımı:

- `filled-light`
- `filled-dark`
- `outline-light`
- `outline-dark`
- `labeled-light`

Not:

- kullanıcıya basit bir deneyim sunmak için UI tarafında birleşik preset gösterilebilir
- iç sözleşmede ise `style` + tema bileşenleri ayrık kalabilir

## `resolution`

`resolution`, raster ve baskı odaklı çıktılarda anlamlıdır.

Örnek değerler:

- `1920x1080`
- `2048x2048`
- `300dpi`

Karar:

- `json` ve `geojson` için uygulanmaz
- `svg` için sınırlı anlam taşır; daha çok viewport/export canvas ölçüsü olarak düşünülebilir
- esas kullanım `png` ve `pdf` tarafındadır

## `fields`

`fields`, kullanıcıya sadece veri dosyalarında değil, veri bağlanabilir render çıktılarında da kontrollü alan seçimi sunar.

### For `json`

- çıktıdaki metadata alanlarını belirler

Örnek:

- `fields=id,name,slug,parent_id`

### For `geojson`

- `properties` içine hangi alanların yazılacağını belirler

Örnek:

- `fields=id,name,parent_id`

### For `svg`

`fields`, SVG elemanlarına gömülecek veri alanlarını belirler.

Bu alanlar `data-*` attribute olarak gömülür.

Örnek:

- `fields=id,name,slug,parent_id`

Çıktı örneği:

```svg
<path
  id="TR-D-34-003"
  data-id="TR-D-34-003"
  data-name="Ataşehir"
  data-slug="atasehir-istanbul"
  data-parent-id="TR-P-34"
/>
```

Bu yaklaşımın amacı:

- kullanıcı kendi tablosu ile join yapabilsin
- SVG sadece görsel değil, veri bağlanabilir asset olsun

### Default Field Policy

Kullanıcı seçim yapmazsa mantıklı varsayılanlar:

- `json`: canonical metadata alanları
- `geojson`: en az `id`, `parent_id`, `level`
- `svg`: en az `id`

Opsiyonel iyi varsayılan:

- `svg`: `id`, `name`

### Recommended Field Presets

Kullanıcı serbest `fields` seçebilir, ama hazır presetler deneyimi hızlandırır.

#### `minimal`

Amaç:

- en hafif veri yüzeyi

İçerik:

- `id`

#### `standard`

Amaç:

- çoğu kullanıcı için güvenli varsayılan

İçerik:

- `id`
- `name`
- `parent_id`

#### `join-ready`

Amaç:

- haritayı harici tabloyla eşleştirmek

İçerik:

- `id`
- `parent_id`
- `slug`
- `name`

#### `admin`

Amaç:

- idari kodlarla çalışan kullanıcılar

İçerik:

- `id`
- `parent_id`
- `plate_code`
- `district_local_code`
- `nuts_code`
- `tuik_id`
- `icisleri_id`

### Format-Specific Default Presets

- `json`
  - varsayılan: canonical metadata alanları
- `geojson`
  - varsayılan: `standard`
- `svg`
  - varsayılan: `join-ready`

## `include_labels` and `label_field`

Render edilmiş çıktılarda `fields` ile `labels` birbirinden ayrılır.

- `fields`
  - veri bağlanabilir attribute setidir
- `include_labels`
  - etiket çizilip çizilmeyeceğini belirler
- `label_field`
  - etiket için kullanılacak alanı belirler

Örnek:

- `include_labels=true`
- `label_field=name`

Varsayılan kural:

- `style=labeled` ise `include_labels=true`
- `label_field` verilmemişse `name`

## Format-Specific Rules

### `json`

- metadata only
- geometri yok
- style yok
- resolution yok

### `geojson`

- geometry + properties
- style yok
- resolution yok
- coordinate order standardı korunmalıdır

### `svg`

- görsel çıktı
- veri bağlanabilir çıktı
- `fields` geçerlidir
- `include_labels` geçerlidir
- `style` geçerlidir

### `png`

- görsel raster çıktı
- `style` geçerlidir
- `resolution` geçerlidir
- veri bağlanabilirlik SVG kadar güçlü değildir

### `pdf`

- baskı / doküman odaklı çıktı
- `style` geçerlidir
- `resolution` veya page size mantığı geçerlidir

### `kml` / `kmz`

- coğrafi paylaşım ve GIS / Earth uyumu için düşünülür
- alan eşleme ayrıca tanımlanmalıdır

### `shp`

- GIS araçları için çok değerlidir
- fakat shapefile çoklu dosya setidir
- field name ve encoding sınırlamaları ayrıca ele alınmalıdır

## Capability Matrix

| Format | Geometry | Metadata | Style | Resolution | Fields | Data-bound | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `json` | no | yes | no | no | yes | n/a | no |
| `geojson` | yes | yes | no | no | yes | yes via `properties` | no |
| `svg` | yes | optional embedded | yes | limited viewport sizing | yes | yes via `id` / `data-*` | yes |
| `png` | rasterized | no direct metadata surface | yes | yes | limited indirect effect | no | yes |
| `pdf` | rendered output | limited indirect metadata | yes | yes | limited indirect effect | no | yes |
| `kml` | yes | yes | limited | no | yes | partial | partial |
| `kmz` | yes | yes | limited | no | yes | partial | partial |
| `shp` | yes | yes | no | no | yes | yes | no |

## Teslim Durumu

### Tamamlanan Formatlar

- `json` — aktif
- `geojson` — aktif
- `topojson` — aktif
- `csv` — aktif
- `xlsx` — aktif
- `sql` — aktif
- `wkt` — aktif
- `kml` — aktif (tarayıcıda filtreli üretim, Google Earth ile doğrulandı)
- `kmz` — aktif (JSZip ile tarayıcıda üretim)
- `svg` — aktif
- `png` — aktif (seçilebilir çözünürlük)
- `shp` — aktif (`dist/shp/` altında ZIP olarak üretiliyor; `.shp + .shx + .dbf + .prj` içeriği)

### Planlanan Formatlar

- `pdf` — planlandı (`dist/shp/` altında ZIP olarak üretiliyor; `.shp + .shx + .dbf + .prj` içeriği)

## Valid UI Logic

UI tarafında kullanıcıya her parametre her zaman gösterilmez.

Kurallar:

- `format=json`
  - `style` gizlenir
  - `resolution` gizlenir
  - `fields` gösterilir
- `format=geojson`
  - `style` gizlenir
  - `resolution` gizlenir
  - `fields` gösterilir
- `format=svg`
  - `style` gösterilir
  - `fields` gösterilir
  - `include_labels` gösterilir
  - `label_field` koşullu gösterilir
- `format=png`
  - `style` gösterilir
  - `resolution` gösterilir
  - `include_labels` gösterilir
- `format=pdf`
  - `style` gösterilir
  - `resolution` veya page preset gösterilir
  - `include_labels` gösterilir

## Encoding Policy

Kullanıcıya ilk aşamada ayrı bir `encoding` parametresi açılmaz.

Varsayılan politika:

- metin tabanlı tüm çıktılar `UTF-8`

Bu özellikle önemlidir:

- `json`
- `geojson`
- `svg`
- `csv`
- `kml`

Not:

- `shp` özel durumda ayrıca format kısıtı ve DBF encoding kuralları gerektirir

## Product Positioning

Bu proje sadece "ham geometri dosyası" sunmaz.

Amaç:

- veri çıktısı vermek
- görsel çıktı vermek
- veriyle eşleşebilir harita asset'i vermek

Özellikle `svg` için hedef:

- kullanıcı bunu bir tablo ile eşleştirebilsin
- kendi uygulamasında renklendirsin
- tooltip bağlasın
- interaktif katman olarak kullansın

Bu yüzden SVG ürün tanımı:

- sadece resim değil
- veri bağlanabilir harita asset'i

## Current Direction

Kısa vadede gerçek çekirdek:

- `json`
- `geojson`
- test UI ile doğrulama

Orta vadede ürünleşecek katman:

- `svg`
- `png`
- `pdf`

Genişletilmiş format hedefleri:

- `kml`
- `kmz`
- `shp`

## Current Dist Contract

Bugün build ile gerçekten üretilen dağıtım yüzeyi şudur:

- `dist/json/provinces.json`
- `dist/json/districts.json`
- `dist/geojson/provinces.geojson`
- `dist/geojson/districts.geojson`

Bu dosyalar `npm run build` içinde şu sırayla üretilir:

1. `scripts/normalize.js`
2. `scripts/assign-ids.js`
3. `scripts/validate.js`
4. `scripts/export.js`

### `dist/json`

`json` çıktısı metadata merkezlidir.

Province kaydı bugün fiilen şu alanları içerir:

- `id`
- `level`
- `parent_id`
- `name`
- `name_ascii`
- `slug`
- `aliases`
- `plate_code`
- `district_local_code`
- `iso_3166_2`
- `nuts_code`
- `tuik_id`
- `icisleri_id`
- `osm_relation_id`
- `source_hdx_id`
- `centroid`
- `bbox`

District kaydı da aynı çekirdeği paylaşır; district özelinde:

- `parent_id` province kaydına bağlanır
- `district_local_code` doludur
- `lau_code` kaynak bulunduğunda doldurulacaktır

Metadata tarafında temel prensip:

- geometry yoktur
- join anahtarı her zaman `id` alanıdır
- `parent_id` hiyerarşi için kullanılır

### `dist/geojson`

`geojson` çıktısı geometry merkezlidir.

Bugünkü politika:

- her feature canonical `id` taşır
- geometry export öncesi rewind edilir
- feature sırası deterministic olarak `id` üzerinden sabitlenir

Bugün property yüzeyi bilinçli olarak dardır:

- `id`
- `parent_id`
- `level`

Bu sayede:

- geometry dosyası hafif kalır
- metadata şişmesi harita dosyasına taşınmaz
- kullanıcı `json` ile `geojson` dosyasını `id` üzerinden join eder

## SVG Export Direction

Bir sonraki üretim katmanı `dist/svg` olacaktır.

Bu katmanda hedef:

- görsel olarak kullanılabilir SVG üretmek
- ama aynı zamanda tabloyla eşleşebilir veri bağlanabilir asset üretmek

İlk SVG yüzeyi için önerilen kapsam:

- `dist/svg/turkey-provinces.svg`
- `dist/svg/{province-slug}-districts.svg`

### SVG Field Policy

SVG içinde her shape için en az:

- `id`

İyi varsayılan:

- `id`
- `data-id`
- `data-name`
- `data-parent-id`
- `data-slug`

Örnek:

```svg
<path
  id="TR-D-34-003"
  data-id="TR-D-34-003"
  data-name="Ataşehir"
  data-parent-id="TR-P-34"
  data-slug="atasehir-istanbul"
/>
```

### SVG Scope and Detail

İlk mantıklı kombinasyonlar:

- `scope=turkey` + `detail=province`
- `scope=province` + `detail=district`

Yani ilk aşamada:

- tüm Türkiye il haritası
- tek ilin ilçe haritası

üretilir.

### SVG Build Strategy

SVG üretimi mevcut pipeline'ın üstüne eklenecektir:

1. `data/processed` metadata + geometry okunur
2. istenen scope/detail filtresi uygulanır
3. projection ile SVG path üretilir
4. seçilen `fields` `data-*` attribute olarak yazılır
5. çıktı `dist/svg` altına bırakılır

### SVG v1 Non-Goals

İlk SVG fazında şunlar zorunlu değildir:

- tam label placement motoru
- çoklu tema export seti
- province ve district'i aynı SVG içinde çok katmanlı verme
- raster/PDF üretimi

Öncelik:

- doğru geometri
- stabil `id`
- temiz `data-*` attribute yüzeyi
