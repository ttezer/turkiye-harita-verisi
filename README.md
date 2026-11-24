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
| Adana | 15/15 | %100,0 |
| Adıyaman | 1/9 | %11,1 |
| Afyonkarahisar | 18/18 | %100,0 |
| Ağrı | 0/8 | %0,0 |
| Aksaray | 0/8 | %0,0 |
| Amasya | 0/7 | %0,0 |
| Ankara | 25/25 | %100,0 |
| Antalya | 19/19 | %100,0 |
| Ardahan | 0/6 | %0,0 |
| Artvin | 0/9 | %0,0 |
| Aydın | 17/17 | %100,0 |
| Balıkesir | 20/20 | %100,0 |
| Bartın | 0/4 | %0,0 |
| Batman | 0/6 | %0,0 |
| Bayburt | 0/3 | %0,0 |
| Bilecik | 0/8 | %0,0 |
| Bingöl | 0/8 | %0,0 |
| Bitlis | 0/7 | %0,0 |
| Bolu | 9/9 | %100,0 |
| Burdur | 0/11 | %0,0 |
| Bursa | 17/17 | %100,0 |
| Çanakkale | 12/12 | %100,0 |
| Çankırı | 12/12 | %100,0 |
| Çorum | 14/14 | %100,0 |
| Denizli | 19/19 | %100,0 |
| Diyarbakır | 0/17 | %0,0 |
| Düzce | 8/8 | %100,0 |
| Edirne | 9/9 | %100,0 |
| Elazığ | 0/11 | %0,0 |
| Erzurum | 20/20 | %100,0 |
| Erzincan | 0/9 | %0,0 |
| Eskişehir | 0/14 | %0,0 |
| Gaziantep | 9/9 | %100,0 |
| Giresun | 0/16 | %0,0 |
| Gümüşhane | 0/6 | %0,0 |
| Hakkari | 0/5 | %0,0 |
| Hatay | 0/15 | %0,0 |
| Iğdır | 0/4 | %0,0 |
| Isparta | 0/13 | %0,0 |
| İstanbul | 39/39 | %100,0 |
| İzmir | 30/30 | %100,0 |
| Kahramanmaraş | 0/11 | %0,0 |
| Karabük | 0/6 | %0,0 |
| Karaman | 0/6 | %0,0 |
| Kars | 0/8 | %0,0 |
| Kastamonu | 0/20 | %0,0 |
| Kayseri | 16/16 | %100,0 |
| Kırıkkale | 0/9 | %0,0 |
| Kırklareli | 8/8 | %100,0 |
| Kırşehir | 0/7 | %0,0 |
| Kilis | 0/4 | %0,0 |
| Kocaeli | 12/12 | %100,0 |
| Konya | 31/31 | %100,0 |
| Kütahya | 0/13 | %0,0 |
| Malatya | 0/13 | %0,0 |
| Manisa | 0/17 | %0,0 |
| Mardin | 10/10 | %100,0 |
| Mersin | 13/13 | %100,0 |
| Muğla | 13/13 | %100,0 |
| Muş | 0/6 | %0,0 |
| Nevşehir | 0/8 | %0,0 |
| Niğde | 0/6 | %0,0 |
| Ordu | 19/19 | %100,0 |
| Osmaniye | 0/7 | %0,0 |
| Rize | 0/12 | %0,0 |
| Sakarya | 16/16 | %100,0 |
| Samsun | 0/17 | %0,0 |
| Siirt | 0/7 | %0,0 |
| Sinop | 0/9 | %0,0 |
| Sivas | 1/17 | %5,9 |
| Şanlıurfa | 0/13 | %0,0 |
| Şırnak | 0/7 | %0,0 |
| Tekirdağ | 11/11 | %100,0 |
| Tokat | 0/12 | %0,0 |
| Trabzon | 18/18 | %100,0 |
| Tunceli | 0/8 | %0,0 |
| Uşak | 0/6 | %0,0 |
| Van | 0/13 | %0,0 |
| Yalova | 6/6 | %100,0 |
| Yozgat | 0/14 | %0,0 |
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
- [docs/commit-standardi.md](./docs/commit-standardi.md)
- [DATA-LICENSE.md](./DATA-LICENSE.md)

## Lisans

- Kod: [LICENSE](./LICENSE)
- Veri politikasi: [DATA-LICENSE.md](./DATA-LICENSE.md)
