# Her Formatta Türkiye Haritası

Türkiye'nin bölge, il, ilçe ve sınırlı kapsamdaki mahalle verilerini çoklu formatta sunan açık kaynak projedir.

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-yellow.svg)](./LICENSE)
[![Veri Politikasi](https://img.shields.io/badge/Veri-Acik%20Kaynak%20Politikasi-blue)](./DATA-LICENSE.md)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-brightgreen)](https://nodejs.org)

## Projenin kapsamı

- Bölge, il ve ilçe katmanları web arayüzünde çoklu formatta indirilebilir.
- Mahalle katmanı yalnızca yayınlanabilir açık veri kaynağı teyit edilen iller için gösterilir.
- Yerleşim kimlikleri deterministiktir: `TR-R-*`, `TR-P-*`, `TR-D-*`, `TR-Y-*`.
- İndirme formatları: `GeoJSON`, `JSON`, `TopoJSON`, `CSV`, `XLSX`, `SQL`, `WKT`, `KML`, `KMZ`, `SHP`, ayrıca arayüzden `SVG` ve `PNG`.

## Mahalle politikası

Mahalle verisi bu repoda ikiye ayrılır:

- Yayınlanabilir açık veri kaynakları: `source/yayinlanabilir/`
- Doğrulama, karşılaştırma veya izin bekleyen kaynaklar: repo içi çalışma alanlarında tutulur, yayın kaynağı sayılmaz

Web arayüzünde mahalle görünümü şu an yalnızca `source/yayinlanabilir/sources.json` içinde `publishable: true` olarak işaretli il setleriyle sınırlandırılmıştır.

İlk açık veri mahalle kapsamı:

- Ankara
- Bursa
- Denizli
- Gaziantep
- Kayseri
- Konya
- Muğla
- Ordu
- Sakarya
- Sivas

Kısmi açık veri ilçe kapsamlari ayrıca `source/yayinlanabilir/sources.json` içinde tutulur.

## Yayın ve lisans yaklaşımı

- Kod lisansı `MIT`'tir.
- Veri MIT ile yeniden lisanslanmaz.
- Her veri kaynağı kendi lisans ve kullanım koşuluyla değerlendirilir.
- Açık lisansı net olmayan kent rehberi, ArcGIS, TUCBS, TKGM ve benzeri servisler yayın kaynağı olarak kullanılmaz.
- Ticari veya resmi kullanımdan doğacak sorumluluk kullanıcıya aittir; kaynak kurumun güncel şartları ayrıca kontrol edilmelidir.

Detay için: [DATA-LICENSE.md](./DATA-LICENSE.md)

## Klasör yapısı

```text
turkiye_map/
├── source/
│   ├── yayinlanabilir/   -> Yayınlanabilir açık veri kaynakları ve manifestler
│   ├── kamu-kaynak/      -> Çalışma / doğrulama verileri (repoda yayın hattı değil)
│   ├── mulki-idare/      -> Referans listeler ve sayısal kontrol kaynakları
│   ├── hdx/              -> Fallback ve karşılaştırma snapshotları
│   └── reference/        -> Crosswalk, override ve kalite tabloları
├── scripts/              -> Normalize, validate, export adımları
├── dist/                 -> Web ve indirilebilir çıktılar
├── docs/                 -> Tasarım ve karar notları
└── tests/                -> Otomatik testler
```

## Kullanıcıdan gelecek mahalle dosyaları

Senin sonradan vereceğin ham mahalle dosyaları için ayrılmış klasör:

- [source/yayinlanabilir/incoming-mahalle/README.md](D:/turkiye_map/source/yayinlanabilir/incoming-mahalle/README.md)

Bu klasör, yayın kararı verilmemiş ama ileride açık veri olarak değerlendirilecek kullanıcı sağladığı mahalle dosyaları için bekleme alanıdır.

## GitHub Pages notu

Bu proje şu an GitHub Pages mantığıyla çalışan statik dağıtım hedefini koruduğu için çıktı boyutu kritik önemdedir.

- `dist/` altında gerçekten gereken dosyalar tutulur.
- Büyük tekrar dosyaları mümkün olduğunca kaldırılır veya lazy-load edilir.
- Mahalle görünümünde tüm Türkiye önizlemesi sınırlanabilir; bu indirme kapsamını değil, sadece tarayıcıdaki canlı önizlemeyi etkiler.

## Kurulum

```bash
npm install
npm run build:data
npm run build:dist
```

Tam build:

```bash
npm run build
```

Yerel test arayüzü:

```bash
npm run test:ui
```

Otomatik kontroller:

```bash
npm test
npm run test:smoke
```

## Dokümanlar

- [DATA-LICENSE.md](./DATA-LICENSE.md)
- [source/yayinlanabilir/README.md](./source/yayinlanabilir/README.md)
- [docs/pipeline-design.md](./docs/pipeline-design.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- [ISPLANI.md](./ISPLANI.md)

## Lisans

- Kod: [LICENSE](./LICENSE)
- Veri politikası ve kaynak ayrımı: [DATA-LICENSE.md](./DATA-LICENSE.md)
