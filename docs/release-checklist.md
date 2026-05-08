# Release Kontrol Listesi

Snapshot yayinlamadan veya push oncesi son kontrol icin bu listeyi kullan.

## Build

1. Ham veya referans veri degistiyse `npm run build:data` calistir.
2. Mahalle kaynagi degistiyse `npm run build:mahalle-geometries` calistir.
3. Export veya arayuz davranisi degistiyse `npm run build:dist` calistir.
4. Emin degilsen `npm run build` calistir.

## Test

1. `npm test`
2. `npm run test:smoke`
3. `npm run test:ui`

## Manuel kontrol

1. En az birer `Bolge`, `Il`, `Ilce` ve `Mahalle` gorunumu ac.
2. En az su formatlari indirip kontrol et:
   - `geojson`
   - `xlsx`
   - `kml`
   - `gpkg`
   - `svg`
   - `png`
   - `pdf`
3. `Detay = Bolge` iken bolge geometrisinin ic il siniri gostermedigini dogrula.
4. Mahalle gorunumu olan bir ilde kalite notu ve arama akisini kisa kontrol et.

## Veri kaynagi kontrolu

1. Il ve ilce icin aktif kaynagin `HDX` oldugunu dogrula.
2. Mahalle icin yalnizca acik veri ve manuel kaynak kullanildigini dogrula.
3. `archive/` altindaki dosyalarin varsayilan build akisina girmedigini dogrula.

## Belge kontrolu

1. Kullaniciya gorunur davranis degistiyse `README.md` guncel mi kontrol et.
2. Veri kapsami veya kaynaklar degistiyse [data-sources.md](./data-sources.md) guncel mi kontrol et.
3. Pipeline akisi degistiyse [pipeline.md](./pipeline.md) guncel mi kontrol et.
4. Urun seviyesinde degisiklik varsa `CHANGELOG.md` guncelle.
