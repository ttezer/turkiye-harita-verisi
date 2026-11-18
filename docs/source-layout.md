# Kaynak Dosyası Standardı

Bu belge, `source/` altındaki mahalle kaynaklarının tek tip yerleşimini tanımlar.

## Temel kurallar

- HDX kaynakları kendi klasöründe kalır ve HDX manifestosu korunur.
- Mahalle geometrileri yalnızca iki sınıfa ayrılır: `manuel` ve `açık kaynak`.
- Geometri dosyaları `source/reference/` altında tutulmaz.
- İlçe adına göre ayrı kaynak klasörü açılmaz.
- Her il için mahalle kaynağı tek dosya olur.
- Ham dosya, ilgili ilin `raw/` klasöründe tutulur.
- `raw` klasörü dosya formatı değildir. Kaynağın özgün uzantısı korunur (`.kml`, `.geojson`, `.zip` gibi).
- Üretilmiş GeoJSON, rapor ve coverage dosyaları `dist/` veya `data/processed/` altında kalır; `source/` içine kopyalanmaz.

## Manuel mahalle kaynağı

Manuel il kaynağı için hedef yol:

```text
source/mahalle-manual/<plaka>-<il>/raw/<il>-mahalle.kml
```

Örnek:

```text
source/mahalle-manual/67-zonguldak/raw/zonguldak-mahalle.kml
```

Bir ilçeye ait düzeltme, ayrı bir ilçe dosyası olarak tutulmaz; ilgili ilin tek KML dosyasına işlenir.

## Açık kaynak mahalle kaynağı

Açık kaynakta özgün dosya formatı korunur:

```text
source/yayinlanabilir/municipal/<plaka>-<il>/mahalle/raw/<il>-mahalle.<özgün-uzantı>
```

Kısmi kapsamlı bir veri de ilçe klasörüne taşınmaz. Kapsam bilgisi kaynak yapılandırmasında tutulur; dosya yine ilin tek `raw/` dosyasıdır.

## Pipeline kuralı

Her aktif kaynak, `scripts/normalize-mahalle-geometrileri.js` içinde tek bir dosya yoluyla tanımlanır. Dosya yolu ile klasör düzeni uyuşmuyorsa kaynak build'e alınmaz ve kontrol başarısız olur.

## Temizlik ve kontrol

- `source/reference/` yalnızca tablo, eşleme ve kalite yardımcılarını içerir; mahalle geometrisi içermez.
- Geçici indirmeler ve deneme çıktıları `tmp/` altında tutulur; yayınlanan kaynak değildir.
- İl dosyası birleştirildikten sonra il toplamı, ilçe toplamları, tekrar eden adlar, birebir geometriler, boş geometriler ve şüpheli kesişimler kontrol edilir.
- Kaynak düzeni değişince push yapılmaz; önce yerel QC ve kullanıcı onayı alınır.
