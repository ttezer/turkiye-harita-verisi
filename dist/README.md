# dist/

Bu klasör `npm run build:dist` komutuyla otomatik üretilen çıktıları içerir.

## Klasör Yapısı

```text
dist/
├── json/          # Metadata JSON (regions, provinces, districts)
├── geojson/       # GeoJSON geometri dosyaları
├── topojson/      # TopoJSON dosyaları
├── csv/           # CSV tabloları (centroid ve bbox kolonları ayrı)
├── xlsx/          # Çok sayfalı Excel çalışma kitabı
├── sql/           # PostgreSQL/SQLite INSERT deyimleri
├── wkt/           # WKT geometri dosyaları
├── kml/           # KML dosyaları (Google Earth uyumlu)
├── kmz/           # KMZ dosyaları (sıkıştırılmış KML)
├── shp/           # Shapefile ZIP paketleri (.shp + .shx + .dbf + .prj, WGS84)
└── svg/           # Scalable Vector Graphics haritaları
```

## CSV Kolon Yapısı

CSV dosyaları şu uzamsal kolonları içerir:

| Kolon | Açıklama |
|-------|----------|
| `centroid_lat` | Merkez noktası enlemi |
| `centroid_lon` | Merkez noktası boylamı |
| `bbox_min_lon` | Batı sınırı (min lon) |
| `bbox_min_lat` | Güney sınırı (min lat) |
| `bbox_max_lon` | Doğu sınırı (max lon) |
| `bbox_max_lat` | Kuzey sınırı (max lat) |

## Notlar

- Bu klasör `.gitignore` kapsamı dışındadır (GitHub Pages için gerekli)
- Kaynak veri değiştiğinde `npm run build:data && npm run build:dist` ile yeniden üretin
- `geometry_wkt` yalnızca `dist/wkt/` ve ilgili ileri düzey export yüzeylerinde kullanılır; CSV ve XLSX içine yazılmaz
