# Veri Kaynakları

Bu belge, build hattındaki aktif kaynakları ve kapsam sınırlarını özetler. Sayısal
özetler son başarılı build'in ürettiği
[`dist/json/mahalle-geometrileri-report.json`](../dist/json/mahalle-geometrileri-report.json)
ve [`dist/json/mahalle-geometrileri-coverage.json`](../dist/json/mahalle-geometrileri-coverage.json)
dosyalarından kontrol edilmelidir.

## İl ve ilçe

- Aktif kaynak: repo içine alınmış `HDX` / `COD-AB-TUR` snapshot'ı
- Kullanım: il ve ilçe metadata'sı ile polygon geometrisi
- Çalışma şekli: canlı API çağrısı değil, pinlenmiş yerel dosya
- Kaynak ayrıntısı: [`source/hdx/README.md`](../source/hdx/README.md)

## Mahalle

Mahalle kapsamı Türkiye geneli değildir. Yalnızca kaynak dosyası ve yayın kararı
pipeline'a tanımlanmış illerde geometri üretilir.

15 Kasım 2026 tarihli mevcut build özeti:

- 27 aktif mahalle kaynağı
- 27 ilde kapsam
- 18.657 üretilmiş mahalle geometrisi
- 16 manuel kaynak: Adıyaman, Antalya, Aydın, Balıkesir, Bolu, Çanakkale,
  Düzce, Edirne, Erzurum, İstanbul, İzmir, Kırklareli, Kocaeli, Tekirdağ,
  Yalova ve Zonguldak
- 11 açık veri/belediye kaynağı: Ankara, Bursa, Denizli, Gaziantep, Kayseri,
  Konya, Muğla, Ordu, Sakarya, Sivas ve Trabzon

Manuel kaynakların ham dosyaları `source/mahalle-manual/`, belediye/açık veri
snapshot'ları `source/yayinlanabilir/municipal/` altında tutulur. Her dosya
otomatik olarak aktif değildir; kaynak, eşleme ve kalite ayarları
`scripts/normalize-mahalle-geometrileri.js` içinde tanımlıdır.

## Kalite ve kapsam notları

Kalite paneli iki tür sinyal kullanır:

- `source/reference/quality-overrides.json`: elle gözden geçirilmiş notlar
- `mahalle-geometrileri-report.json`: build sırasında üretilen eşleşme, OSB,
  geometri onarımı ve uzak multipolygon sinyalleri

`limited_source_coverage`, kaynağın il geneli yerine tek ilçe veya sınırlı alan
üretmesi için kullanılır. Kalite notunun bulunmaması verinin yüzde yüz
doğrulandığı anlamına gelmez.

## Referans ve doğrulama kaynakları

- `source/mulki-idare/`: yerleşim sayıları ve adlandırma karşılaştırmaları
- `source/reference/`: crosswalk, bölge üyeliği ve kalite tabloları
- `source/yayinlanabilir/sources.json`: mahalle kaynak envanteri ve yayın kararı

Bu referanslar, açıkça pipeline'a bağlanmadıkça aktif geometri kaynağı değildir.
