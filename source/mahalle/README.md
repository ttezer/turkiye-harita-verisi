# Mahalle Geometri Kaynaklari

Bu klasor, mahalle sinir geometrileri icin yerel kaynak dosyalarini bekler. Ham belediye dosyalari repoya dahil edilmez; kaynak URL'leri, erisim tarihleri ve beklenen yerel dosya konumlari `sources.json` icinde tutulur.

Yerel dosya yapisi:

```text
source/mahalle/{il_adi}/
```

Beklenen mevcut kaynaklar:

- Sakarya: `source/mahalle/sakarya/sakarya_mahalle.kmz` (kaynak: `https://veri.sakarya.bel.tr/`)
- Mugla: `source/mahalle/mugla/Mahalleler.shp` ve yan dosyalari (kaynak: `https://cbs.mugla.bel.tr/blog/cbs-acik-veri`)
- Denizli: yerel dosya beklenmez; belediye adres sistemi kullanilir (kaynak: `https://adres.denizli.bel.tr/`)
- Kocaeli: yerel dosya beklenmez; belediye kent rehberi kullanilir (kaynak: `https://rehber.kocaeli.bel.tr/`)
- Gaziantep: `source/mahalle/gaziantep/mahalle_sinirlari.kml` (kaynak: `https://acikveri.gaziantep.bel.tr/`)

Notlar:

- Ham `.shp`, `.dbf`, `.shx`, `.prj`, `.kmz`, `.kml` ve benzeri dosyalar `.gitignore` ile disarida tutulur.
- Kaynaklar bilgi amacli belediye acik veri yayinlaridir; resmi is ve islemler icin kullanmadan once ilgili kurum kosullari kontrol edilmelidir.
- Geometri verileri, ileride `dist/json/yerlesimler.json` icindeki e-Icisleri mahalle kayitlariyla eslestirilerek islenecektir.

## Veri Kalitesi ve Sorumluluk

Mahalle geometri kaynaklari farkli belediye acik veri ve kent rehberi servislerinden derlenir. Kaynak veriler kurumlar tarafindan guncellenebilir, eksik olabilir, hatali geometri icerebilir veya resmi islem amaciyla kullanima uygun olmayabilir.

Bu proje veriyi acik kaynak yazilim ve veri entegrasyonu amaciyla isler; kaynak verinin dogrulugunu, guncelligini, hukuki uygunlugunu veya belirli bir kullanim amacina elverisliligini garanti etmez.

Bilinen veri kalite notlari `quality-notes.json` icinde tutulur ve uygulama arayuzunde filtreye gore gosterilir. Ancak bu notlar tum olasi kaynak/veri hatalarini kapsamaz.

Bu verilerin ticari, resmi, hukuki, muhendislik, imar, adres tespiti, mulkiyet, lojistik kararlari veya benzeri sonuc doguran kullanimlarinda sorumluluk kullaniciya aittir. Kullanici, ilgili kurumlarin lisans ve kullanim kosullarini ayrica kontrol etmekle yukumludur.

Ham kaynak dosyalari repoya dahil edilmez; yalnizca kaynak sayfalari, erisim tarihleri ve isleme kurallari referans olarak tutulur.
