# Download Manual QA

Tarayıcıdan `npm run test:ui` ile açılan arayüz üzerinde uygulanır.

URL:

- `http://127.0.0.1:4173`

## Genel Kontrol

Her format için şunları kontrol et:

- `İndir` butonu gerçekten dosya indiriyor mu
- indirilen dosya adı seçili `scope/detail` ile uyumlu mu
- dosya içeriği ekrandaki filtre ile uyumlu mu
- `Planlanan` formatlarda buton pasif mi

## Hızlı Tur

### 1. JSON

- Format: `JSON`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.json`
- Beklenti: 11 il kaydı, her kayıtta `id`, `name`, `region_id`, `region_name`

### 2. GeoJSON

- Format: `GeoJSON`
- Scope: `province`
- Detail: `district`
- Province: `İstanbul`
- Beklenen dosya adı: `istanbul-districts.geojson`
- Beklenti: sadece İstanbul ilçeleri, `FeatureCollection`

### 3. TopoJSON

- Format: `TopoJSON`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.topojson`
- Beklenti: `Topology` root objesi, sadece Marmara illeri

### 4. CSV

- Format: `CSV`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.csv`
- Beklenti: 1 header + 11 satır

### 5. XLSX

- Format: `XLSX`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.xlsx`
- Beklenti: tek sheet `provinces`, 11 satır veri

### 6. SQL

- Format: `SQL`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.sql`
- Beklenti: `CREATE TABLE provinces` ve 11 `INSERT`

### 7. WKT

- Format: `WKT`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.wkt`
- Beklenti: 11 satır, her satırda `id`, `name`, `geometry`

### 8. KML

- Format: `KML`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.kml`
- Beklenti: 11 `Placemark`

### 9. KMZ

- Format: `KMZ`
- Scope: `turkey`
- Detail: `province`
- Beklenen dosya adı: `turkiye-provinces.kmz`
- Beklenti: zip içinde `doc.kml`

Not:

- KMZ şu aşamada filtreli üretim için doğrulanmış değil; önce Türkiye geneli kontrol edilmeli.

### 10. SVG

- Format: `SVG`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.svg`
- Beklenti: açıldığında görsel bozuk değil, `data-*` attribute’ları mevcut

### 11. PNG

- Format: `PNG`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Resolution: `1920x1080`
- Beklenen dosya adı: `marmara-provinces.png`
- Beklenti: görsel boş değil, çözünürlük doğru

### 12. SHP

- Format: `SHP`
- Scope: `region`
- Detail: `province`
- Region: `Marmara`
- Beklenen dosya adı: `marmara-provinces.zip`
- Beklenti: ZIP içinde `.shp + .shx + .dbf + .prj` dosyaları

## Planlanan Formatlar

Şunlarda buton aktif olmamalı:

- `gpkg`
- `pdf`
- `react-component`
- `ai`
- `eps`
- `obj`
- `stl`
- `glb`
- `gltf`
