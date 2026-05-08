# Yayinlanabilir Acik Veri Kaynaklari

Bu klasor, GitHub uzerinden yayinlanmasi uygun gorulen acik veri kaynaklari icin ayrilmistir.

Buraya yalnizca su sartlardan en az biri saglandiginda veri veya manifest alinir:

- acik veri portali
- acik lisans
- acik indirilebilir kaynak
- yeniden dagitim sarti acikca gorunen kurum verisi

## Bu klasorde ne tutulur

- kaynak manifestleri
- acik veri ham dosyalari
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

Guncel resmi liste icin:

- [sources.json](/D:/turkiye_map/source/yayinlanabilir/sources.json)

## Kullanicidan gelecek mahalle dosyalari

Yeni ham mahalle dosyalari once su klasore birakilmalidir:

- [incoming-mahalle](/D:/turkiye_map/source/yayinlanabilir/incoming-mahalle)

Bu klasorun amaci:

- dosyayi kaybetmeden sabit bir yerde toplamak
- kaynak kararini sonradan verebilmek
- manifest hazirlanmadan once ham dosyayi ayri tutmak

Dosya geldiginde hemen yayinlanabilir kabul edilmez; once lisans, kapsam ve kalite kontrol edilir.

## Kapsam notu

- Bir il kaynagi yalnizca merkez ilceyi veya kisitli bir alt bolgeyi kapsiyorsa bu durum bug diye yorumlanmamalidir.
- Boyle durumlar `source/reference/quality-overrides.json` icinde `limited_source_coverage` olarak isaretlenmelidir.
