# Her Formatta Türkiye Haritası

Tarayıcı üzerinden bölge, il, ilçe ve sınırlı mahalle verisi seçtirip çoklu formatta indiren açık kaynak bir web arayüzü.

Ana kullanım:

1. Kapsam seç
2. Detay seç
3. Format seç
4. İndir

Bu repo bir framework veya starter kit değil, ürünün kaynak deposudur.

## Desteklenen Katmanlar

- Bölge
- İl
- İlçe
- Mahalle

Mahalle katmanı yalnızca doğrulanmış açık veri veya manuel kaynak bulunan illerde üretilir.

## Desteklenen Formatlar

- GeoJSON
- JSON
- TopoJSON
- CSV
- XLSX
- SQL
- WKT
- KML
- KMZ
- GML
- OSM
- SHP
- DXF
- GPKG
- SVG
- PNG
- PDF
- React Component

## Veri Modeli

- İl ve ilçe için aktif kaynak: `HDX`
- Mahalle için aktif kaynak: `source/yayinlanabilir/` altındaki açık veri ve `source/mahalle-manual/` altındaki manuel kaynaklar
- Pasif referans arşivi: `archive/`

## Hızlı Başlangıç

```bash
npm install
npm run build
```

Yerel test arayuzu:

```bash
npm run test:ui
```

Otomatik kontroller:

```bash
npm test
npm run test:smoke
```

## Dizin Ozeti

```text
source/   ham ve referans veri
scripts/  normalize, validate ve export adimlari
dist/     uretilmis cikti dosyalari
docs/     kisa urun ve pipeline belgeleri
tests/    otomatik testler
```

## Temel Belgeler

- [CHANGELOG.md](./CHANGELOG.md)
- [docs/data-sources.md](./docs/data-sources.md)
- [docs/pipeline.md](./docs/pipeline.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- [DATA-LICENSE.md](./DATA-LICENSE.md)

## Lisans

- Kod: [LICENSE](./LICENSE)
- Veri politikasi: [DATA-LICENSE.md](./DATA-LICENSE.md)
