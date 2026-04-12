# Veri Modeli

## Metadata / Geometri Ayrımı

Bu repo, metadata ile geometriyi kasıtlı olarak ayrı tutar.

Neden:

- geometri dosyaları büyük olabilir
- tüketicilerin çoğu geometriden daha sık metadata'ya ihtiyaç duyar
- aynı metadata birden fazla geometri formatında dışa aktarılabilir

Birleştirme kuralı:

- metadata'daki kanonik anahtar her zaman `id`'dir
- geometri feature'ları metadata'ya `properties.id` üzerinden bağlanır

## Kanonik Metadata Alanları

### İnsan tarafından okunabilir

- `name`: kanonik görüntüleme adı
- `name_ascii`: deterministik ASCII'ye dönüştürülmüş ad
- `slug`: URL uyumlu string
- `aliases`: alternatif adlar

Slug kuralı:

- il için `slug = name_ascii`
- ilçe için `slug = ${name_ascii}-${province_slug}`

### İdari

- `plate_code`: il plaka kodu
- `iso_3166_2`: il düzeyinde uluslararası kod
- `nuts_code`: yalnızca il düzeyinde NUTS-3 kodu
- `lau_code`: yalnızca ilçe düzeyinde istatistiki kod, mevcut olduğunda
- `tuik_id`: TÜİK referans kimliği
- `icisleri_id`: İçişleri Bakanlığı / MİB referans kimliği

Kural:

- `tuik_id` ve `icisleri_id` değerleri örtüşse bile ayrı alanlar olarak kalır

## İl

- `level = province`
- `parent_id = null`
- `nuts_code` dolu olabilir
- `lau_code = null`

## İlçe

- `level = district`
- `parent_id = province.id`
- `nuts_code = null`
- bir ilçe düzeyinde istatistiki referans eklendiğinde `lau_code` dolu olabilir

## Uzamsal

- `centroid`: `{ "lat": number, "lon": number }`
- `bbox`: `[min_lon, min_lat, max_lon, max_lat]`

Notlar:

- GeoJSON geometrisi uzamsal çalışmalar için gerçek kaynak olmaya devam eder
- `bbox`, `fitBounds` gibi harita görüntü alanı işlemleri için yardımcı bir alandır
