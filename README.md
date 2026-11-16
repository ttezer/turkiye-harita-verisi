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

- JSON
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

- İdari hiyerarşi: `region -> province -> district`
- İl ve ilçe için aktif kaynak: `HDX`
- Mahalle için aktif kaynaklar: `source/yayinlanabilir/municipal/` altındaki açık veri snapshot'ları ve `source/mahalle-manual/` altındaki tanımlı manuel kaynaklar
- Mahalle kapsamı ve kalite özeti: [`dist/json/mahalle-geometrileri-report.json`](./dist/json/mahalle-geometrileri-report.json)

### Mahalle İlçe Tamamlama

Yüzde, mahalle sayısına göre değil; mahalle geometrisi tamamlanan ilçe sayısının
ildeki toplam ilçe sayısına oranına göre hesaplanır. Aşağıdaki tablo, mahalle
kaynağı bulunan illerin ilçe kapsamını gösterir.

| İl | Tamamlanan ilçe | Oran |
| --- | ---: | ---: |
| Adıyaman | 1/9 | %11,1 |
| Ankara | 25/25 | %100,0 |
| Antalya | 19/19 | %100,0 |
| Aydın | 17/17 | %100,0 |
| Balıkesir | 20/20 | %100,0 |
| Bolu | 9/9 | %100,0 |
| Bursa | 17/17 | %100,0 |
| Çanakkale | 12/12 | %100,0 |
| Denizli | 19/19 | %100,0 |
| Düzce | 8/8 | %100,0 |
| Edirne | 9/9 | %100,0 |
| Erzurum | 20/20 | %100,0 |
| Gaziantep | 9/9 | %100,0 |
| İstanbul | 39/39 | %100,0 |
| İzmir | 30/30 | %100,0 |
| Kayseri | 16/16 | %100,0 |
| Kırklareli | 8/8 | %100,0 |
| Kocaeli | 12/12 | %100,0 |
| Konya | 31/31 | %100,0 |
| Muğla | 13/13 | %100,0 |
| Ordu | 19/19 | %100,0 |
| Sakarya | 16/16 | %100,0 |
| Sivas | 1/17 | %5,9 |
| Tekirdağ | 11/11 | %100,0 |
| Trabzon | 18/18 | %100,0 |
| Yalova | 6/6 | %100,0 |
| Zonguldak | 8/8 | %100,0 |

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
source/          ham ve referans veri
data/processed/  pipeline ara ve rapor çıktıları
scripts/         normalize, validate ve export adımları
dist/            üretilmiş tüketici çıktıları
docs/            ürün ve pipeline belgeleri
tests/           otomatik testler
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
