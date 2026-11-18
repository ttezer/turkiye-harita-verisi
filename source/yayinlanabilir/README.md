# Yayinlanabilir Acik Veri Kaynaklari

Bu klasor, GitHub uzerinden yayinlanmasi uygun gorulen acik veri kaynaklari icin ayrilmistir.

Buraya yalnizca su sartlardan en az biri saglandiginda veri veya manifest alinir:

- acik veri portali
- acik lisans
- acik indirilebilir kaynak
- yeniden dagitim sarti acikca gorunen kurum verisi

## Bu klasorde ne tutulur

- kaynak manifestleri
- `municipal/` altindaki acik veri snapshot'lari
- kismi ilce veya il bazli acik veri dosyalari
- yayin kararini destekleyen notlar
- kapsam sinirlarini aciklayan province-level notlar

## Bu klasorde ne tutulmaz

- lisansi belirsiz kent rehberi servisleri
- token gerektiren veya izin bekleyen servis ciktilari
- yalnizca dogrulama icin kullanilan karsilastirma verileri
- mulki idare referans listeleri

## Guncel mahalle acik veri illeri

- Ankara
- Bursa
- Denizli
- Gaziantep
- Kayseri
- Konya
- Mugla
- Ordu
- Sakarya
- Sivas
- Trabzon

Guncel resmi liste icin:

- [sources.json](./sources.json)

## Klasor standardi

Her il kendi klasoru altinda tek bir `mahalle/raw` yolu kullanir. İlçe adına
ayri ham veri klasörü açılmaz. Özgün dosya uzantısı korunur; ayrıntılı düzen
kuralları için [kaynak dosyası standardına](../../docs/source-layout.md) bakın.

## Kapsam notu

- Bir il kaynagi yalnizca merkez ilceyi veya kisitli bir alt bolgeyi kapsiyorsa bu durum bug diye yorumlanmamalidir.
- Boyle durumlar `source/reference/quality-overrides.json` icinde `limited_source_coverage` olarak isaretlenmelidir.
