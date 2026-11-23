# Pipeline

## Amaç

Bu repo tek bir web arayüzünden çoklu format indirme üretir. Veri hattı, ham kaynakları normalize edip sabit kimlikli ürün verisine dönüştürür.

## Akış

1. `normalize`
   İl ve ilçe için HDX kaynağını normalize eder.
2. `assign-ids`
   Deterministik `TR-R-*`, `TR-P-*`, `TR-D-*` kimliklerini üretir.
3. `normalize-yerlesimler`
   Yerleşim metadata setini işler.
4. `normalize-bagli-yerlesimler`
   Bağlı yerleşim metadata setini ve raporunu üretir.
5. `normalize-mahalle-geometrileri`
   Açık veri ve manuel mahalle kaynaklarını eşleyip ilçe bazlı geometri üretir.
6. `build-district-boundaries`
   Mahalle geometrisi bulunan ilçeler için mahalle birleşimini üretir; sayım ve çok parçalı mahalle parça QC'sinde sorun bulunan ilçeleri beklemeye alıp mevcut sınırlarını korur. Mahalle verisi olmayan ilçelerde HDX geometrisi kalır. Ayrıntılar `docs/district-boundary-qc.md` içindedir.
7. `validate`
   Üretilen veri setlerini şema ve temel sayı kontrollerinden geçirir.
8. `export`
   `dist/` altındaki JSON, GeoJSON, TopoJSON, CSV, XLSX, SQL, WKT, KML, KMZ,
   GML, OSM, SHP, DXF ve GPKG çıktıları üretir. SVG, PNG, PDF ve React
   Component çıktıları tarayıcı tarafında üretilir.

## Temel Komutlar

Tam build:

```bash
npm run build
```

Sadece veri:

```bash
npm run build:data
```

Sadece mahalle geometri:

```bash
npm run build:mahalle-geometries
```

Sadece export:

```bash
npm run build:dist
```

## Testler

```bash
npm test
npm run test:smoke
npm run test:ui
```

## Kaynak Kuralları

- İl ve ilçe için aktif kaynak `HDX`
- Mahalle için yalnızca doğrulanmış açık veri veya manuel kaynak kullanılır
- `source/mulki-idare/` doğrulama/referans içindir; varsayılan mahalle geometri akışına girmez
- Yerel inceleme dosyaları entegre edilmedikçe commit setine alınmamalıdır

## Yeni Mahalle Kaynağı Eklerken

1. Ham dosyayı uygun `source/yayinlanabilir/municipal/` veya `source/mahalle-manual/` klasörüne koy
2. Gerekliyse manifest veya manuel metadata ekle
3. `scripts/normalize-mahalle-geometrileri.js` içinde kaynağı açıkça tanımla
4. `npm run build:mahalle-geometries` çalıştır
5. `dist/json/mahalle-geometrileri-report.json`, coverage çıktısı ve district dosyalarıyla doğrula

## Debug İlkesi

- Sorun önce veri mi, normalize mi, export mu ayrılmalı
- UI'ı en son suçla
- Geçici debug notları repo merkezinde tutulmamalı
