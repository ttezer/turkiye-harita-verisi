# Türkiye'mizin Bölge, İl ve İlçe İdari Sınırları

**Türkiye'mizin bölge, il ve ilçe idari sınırlarını deterministik kimliklerle, çoklu formatta sunan açık veri pipeline'ı.**

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-yellow.svg)](./LICENSE)
[![Veri Kaynağı](https://img.shields.io/badge/Veri-HDX%20%2F%20OCHA-blue)](https://data.humdata.org/dataset/cod-ab-tur)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-brightgreen)](https://nodejs.org)

---

## Neden Bu Proje?

Piyasadaki statik GeoJSON dosyalarının aksine bu proje veriyi sadece sunmaz; işler, doğrular ve projenize özel hale getirir.

- **Deterministik kimlikler** — Plaka kodları ve ISO standartlarıyla uyumlu, kararlı ID yapısı (`TR-P-34`, `TR-D-34-001`)
- **Hatasız geometri** — Tüm veriler `validate.js` ile topolojik ve hiyerarşik kontrolden geçer
- **Esnek export hattı** — Tek komutla 10+ farklı formatta çıktı üretimi
- **Kendi verina inşa et** — Repoyu fork ederek özel filtreleme, alan seçimi ve veri zenginleştirme yapabilirsin

---

## Desteklenen Formatlar

| Vektör / CBS | Tabular / Veri | Görsel / Web |
| :--- | :--- | :--- |
| GeoJSON | CSV | SVG |
| TopoJSON | XLSX | PNG |
| KML | SQL | — |
| KMZ | WKT | — |
| JSON | — | — |

Planlanan formatlar: `SHP`, `GeoPackage`, `PDF`, `React Component`, `AI`, `EPS`, `OBJ`, `STL`, `GLB`, `GLTF`

---

## Kimlik Standardı

| Seviye | Format | Örnek |
| :--- | :--- | :--- |
| Bölge | `TR-R-XXX` | `TR-R-MAR` |
| İl | `TR-P-XX` | `TR-P-34` |
| İlçe | `TR-D-XX-YYY` | `TR-D-34-001` |

Kurallar:

- `XX` il plaka kodudur (sıfır dolgulu, iki hane)
- `YYY` il içindeki deterministik sıradır (aralıksız, üç hane)
- ilçe sıralaması pipeline kurallarıyla sabitlenir ve sürümler arasında kararlı kalır

---

## Veri Modeli

### Temel Kimlik
- `id`, `level`, `parent_id`

### İnsan Okunur Alanlar
- `name`, `name_ascii`, `slug`, `aliases`

### İdari Referanslar
- `plate_code`, `district_local_code`, `iso_3166_2`
- iller için `nuts_code`, uygunsa ilçeler için `lau_code`

### Dış Eşleştirme Alanları
- `tuik_id`, `icisleri_id`, `osm_relation_id`, `source_hdx_id`

### Mekansal Alanlar
- `centroid` → `{ lat, lon }`
- `bbox` → `[min_lon, min_lat, max_lon, max_lat]`

---

## Pipeline Akışı

```
Ham kaynak (HDX)
    → Normalize et ve temizle
    → Crosswalk ile zenginleştir (TÜİK / NUTS / ISO / OSM)
    → Deterministik kimlik ata
    → Şema + hiyerarşi doğrulaması
    → JSON / GeoJSON / TopoJSON / CSV / XLSX / SQL / WKT / KML / KMZ
```

---

## Klasör Yapısı

```
turkiye_map/
├── source/          → ham ve referans veriler (HDX snapshot, crosswalk)
├── schema/          → JSON Schema tanımları
├── scripts/         → normalize, assign-ids, validate, export pipeline
├── data/
│   ├── raw/
│   ├── normalized/
│   └── processed/
├── dist/            → npm run build:dist ile üretilen çıktılar
│   ├── json/
│   ├── geojson/
│   ├── topojson/
│   ├── csv/
│   ├── xlsx/
│   ├── sql/
│   ├── wkt/
│   ├── kml/
│   └── kmz/
├── test-ui/         → görsel smoke test arayüzü
├── packages/        → JS tüketim paketi
├── examples/        → kullanım örnekleri
└── docs/            → tasarım ve karar belgeleri
```

---

## Kurulum ve Kullanım

```bash
# Bağımlılıkları yükle
npm install

# Veri pipeline'ını çalıştır (normalize → assign-ids → validate)
npm run build:data

# Tüm formatlarda çıktı üret (dist/ klasörüne)
npm run build:dist

# Tam build (data + dist birlikte)
npm run build
```

Görsel smoke test:

```bash
npm run build:dist   # gerekirse
npm run test:ui      # geliştirme sunucusunu başlatır
# → http://127.0.0.1:4173
```

Otomatik testler:

```bash
npm test             # unit testler
npm run test:smoke   # dist artifact kontratlarını doğrular
npm run example:js   # JS paket örneği
```

---

## Kendi Verini İnşa Et

Repoyu fork ettikten sonra:

- **Özel filtreleme** — belirli bir bölge veya ili içeren özel paketler
- **Hassasiyet ayarı** — `pipeline.js` üzerinden koordinat yuvarlama ile dosya boyutu optimizasyonu
- **Veri zenginleştirme** — kendi özel sütunlarını `crosswalk` dosyalarına ekle; sistem tüm formatlara otomatik dağıtır

Python bağımlılığı: `build:data` adımı `generate-province-crosswalk.py` için Python gerektirir.  
Tüm Python scriptleri `encoding='utf-8'` ile yazılmıştır; Windows ortamlarında Türkçe karakter güvenlidir.

---

## Yol Haritası

### Tamamlanan
- [x] Bölge, il, ilçe sınırları (HDX tabanlı)
- [x] Deterministik kimlik sistemi (`TR-R-*`, `TR-P-*`, `TR-D-*`)
- [x] GeoJSON, JSON, TopoJSON
- [x] CSV, XLSX, SQL, WKT
- [x] KML, KMZ
- [x] SVG, PNG (UI üzerinden)
- [x] Alan seçimi (Fields) UI

### Planlanan — Faz 2
- [ ] SHP (+ prj, cpg, zip paketleme)
- [ ] GeoPackage (gpkg)
- [ ] PDF

### Planlanan — Faz 3
- [ ] React Component
- [ ] AI (Adobe Illustrator)
- [ ] EPS

### Planlanan — Faz 4
- [ ] OBJ / STL (3D baskı ve oyun motoru)
- [ ] GLB / GLTF (web 3D)

---

## Dokümanlar

- [Veri Modeli](./docs/data-model.md)
- [Pipeline Tasarımı](./docs/pipeline-design.md)
- [Kimlik Politikası](./docs/id-policy.md)
- [Bölge Modeli](./docs/region-model.md)
- [Format Yol Haritası](./docs/format-roadmap.md)
- [İndirme Yapılandırıcısı](./docs/download-configurator.md)
- [İndirme Manuel QA](./docs/download-manual-qa.md)
- [Ürün Sözleşmesi](./docs/product-contract.md)
- [Karar Günlüğü](./docs/decision-log.md)
- [Release Kontrol Listesi](./docs/release-checklist.md)
- [XLSX Bağımlılık Notu](./docs/xlsx-dependency-note.md)
- [Katkı Rehberi](./CONTRIBUTING.md)

---

## Lisans

Kaynak kod: **MIT** — ayrıntı için [LICENSE](./LICENSE)

Vendored sınır verisi: **CC BY-IGO** (HDX / OCHA) — ayrıntı için [DATA-LICENSE.md](./DATA-LICENSE.md)

Veri kaynağı: [HDX COD-AB Türkiye](https://data.humdata.org/dataset/cod-ab-tur)
