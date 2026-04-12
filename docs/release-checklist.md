# Release Kontrol Listesi

Etiketli bir snapshot yayınlamadan veya repoyu başka bir ekibe teslim etmeden önce bu listeyi kullan.

## Veri / Build

1. Ham veya referans veri değiştiyse `npm run build:data` çalıştır.
2. Yalnızca export artifact’ları değiştiyse `npm run build:dist` çalıştır.
3. Pipeline geniş ölçekte değiştiyse `npm run build` çalıştır.

## Doğrulama

1. `npm test` çalıştır.
2. `npm run test:smoke` çalıştır.
3. `npm run test:ui` aç ve en az şu formatları manuel kontrol et:
   - `json`
   - `geojson`
   - `csv`
   - `xlsx`
   - `kml`
   - `kmz`
   - `svg`
   - `png`

## Artifact Kontrolleri

1. Şu dosyaların var olduğunu doğrula:
   - `dist/json/regions.json`
   - `dist/geojson/regions.geojson`
   - `dist/topojson/regions.topojson`
   - `dist/csv/provinces.csv`
   - `dist/xlsx/turkiye-map.xlsx`
   - `dist/sql/regions.sql`
   - `dist/wkt/provinces.wkt`
   - `dist/kml/regions.kml`
   - `dist/kmz/regions.kmz`
2. Bölge geometrisinin dissolve edildiğini ve downstream viewer’larda iç il sınırlarını göstermediğini doğrula.

## Bağımlılık İncelemesi

1. `npm audit` kontrol et.
2. Dış yayın öncesi mevcut `xlsx` advisory durumunu tekrar gözden geçir.

## Dokümanlar

1. Durum değiştiyse [todo.md](./todo.md) dosyasını güncelle.
2. UI davranışı değiştiyse [download-manual-qa.md](./download-manual-qa.md) dosyasını güncelle.
3. Build akışı değiştiyse [pipeline-design.md](./pipeline-design.md) dosyasını güncelle.
