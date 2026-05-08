# HDX Kaynağı

Bu dizin, il ve ilçe için aktif kaynak olarak kullanılan vendored `HDX` snapshot'ını tutar.

## Aktif kaynak

- Veri seti: `HDX Türkiye - Subnational Administrative Boundaries`
- Kaynak sayfa: [https://data.humdata.org/dataset/cod-ab-tur](https://data.humdata.org/dataset/cod-ab-tur)
- Repo içi rolü: il ve ilçe normalize akışının tek aktif dış veri kaynağı
- Kullanım biçimi: canlı HTTP yanıtı değil, indirildikten sonra pinlenmiş dosya snapshot'ı

## Lisans ve atıf

- Beklenen lisans ailesi: `CC BY-IGO`
- Kod lisansından ayrıdır; repo `MIT` olması HDX verisini `MIT` yapmaz
- Veriyle ilgili atıf, kaynak ve lisans bilgisi korunmalıdır

Detay politika için:

- [DATA-LICENSE.md](/D:/turkiye_map/DATA-LICENSE.md)

## Kurallar

- canlı HTTP yanıtından doğrudan build alma
- önce pinlenmiş kaynak dosyayı indir
- `manifest.json` içinde dataset id, resource id, URL, checksum ve fetch tarihi tut
- orijinal archive dosyalarını değiştirme
- `extracted/` commitlenmez; gerektiğinde snapshot'tan yeniden üretilir

## Beklenen yapı

```text
source/hdx/
  cod-ab-tur/
    tur_admin_boundaries.geojson.zip
    tur_admin_boundaries.xlsx
    manifest.json
```
