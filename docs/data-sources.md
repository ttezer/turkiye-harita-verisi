# Data Sources

## Amaç

Bu belge, ürünün kullandığı aktif veri kaynaklarını ve kapsam sınırlamalarını tek yerde toplar.

## İl ve İlçe

- Aktif kaynak: `HDX`
- Kullanım: il ve ilçe metadata + polygon geometri
- Not: repo içinde snapshot olarak tutulur; canlı API bağımlılığı yoktur

## Mahalle

Mahalle verisi tüm Türkiye için tam değildir. Yalnızca doğrulanmış açık veri veya manuel kaynak olan illerde üretilir.

Son doğrulama özeti:

- aktif kaynak sayısı: `14`
- üretilen toplam mahalle geometrisi: `10040`

### Aktif mahalle kaynakları

| İl | Kod | Kaynak tipi | Format | Not |
| --- | ---: | --- | --- | --- |
| Ankara | 06 | Belediye açık veri | GeoJSON | OSB/source-only kayıtlar ayıklanır |
| Bursa | 16 | Belediye açık veri | GeoJSON | OSB/source-only kayıtlar ayıklanır |
| Çanakkale | 17 | Manuel kaynak | KML | Kullanıcı tarafından sağlanan aktif kaynak |
| Denizli | 20 | Belediye açık veri | GeoJSON | Tam eşleşme |
| Edirne | 22 | Manuel kaynak | KML | Küçük source-only farkları var |
| Gaziantep | 27 | Belediye açık veri | KML | Tam eşleşme |
| Kayseri | 38 | Belediye açık veri | GeoJSON | Tam eşleşme |
| Kocaeli | 41 | Manuel kaynak | KML | Tam eşleşme |
| Konya | 42 | Belediye açık veri | GeoJSON | Tam eşleşme |
| Muğla | 48 | Belediye açık veri | GeoJSON | Tam eşleşme |
| Ordu | 52 | Belediye açık veri | GeoJSON | Tam eşleşme |
| Sakarya | 54 | Belediye açık veri | GeoJSON | Az sayıda source-only farkı var |
| Sivas | 58 | Belediye açık veri | GeoJSON | Kapsam sınırlı; il geneli değil |
| Trabzon | 61 | Belediye açık veri | GeoJSON | Tam eşleşme |

## Kalite ve Kapsam Notları

Kalite paneli iki kaynaktan beslenir:

- `source/reference/quality-overrides.json`
- `data/processed/mahalle-geometrileri-report.json`

Temel ilke:

- kalite notu görünmemesi, verinin `%100` doğrulandığı anlamına gelmez
- `limited_source_coverage`, kaynağın il geneli yerine tek ilçe veya sınırlı alan üretmesi için kullanılır
- OSB, source-only alan ve geometri onarımları kalite sinyali olarak işaretlenebilir

## Manuel Kaynaklar

Manuel mahalle dosyaları:

- `source/mahalle-manual/`

Şu an aktif manuel il örnekleri:

- Çanakkale
- Edirne
- Kocaeli

## Referans Dosyalar

- `scripts/normalize-mahalle-geometrileri.js`
- `data/processed/mahalle-geometrileri-report.json`
- `data/processed/mahalle-geometrileri-coverage.json`
- `source/reference/quality-overrides.json`
