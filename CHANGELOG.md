# Degisiklik Gecmisi

## [Yayinlanmamis]

### Eklendi

- Erzurum icin manuel mahalle kaynagi, uretim betigi ve 20 ilceye ait yayinlanabilir geometri ciktilari eklendi.
- Besni (Adiyaman) manuel mahalle sinirlari kaynak envanterine ve Pages yayin paketine dahil edildi.
- Netcad uyumlu DXF ciktilari ve GeoPackage export akisi eklendi; GeoPackage artifact'i yeniden yayin paketine alindi.
- Canakkale icin manuel mahalle KML kaynagi eklendi ve normalize hattina baglandi.
- GML, OSM, GeoPackage ve React Component cikti destegi genisletildi.
- Mahalle kaynak envanteri ve kalite notlari icin sadelestirilmis belge yapisi hazirlandi.

### Degistirildi

- Kaynak, referans, veri modeli, lisans ve release belgeleri guncel pipeline yapisiyla uyumlu hale getirildi.
- Mahalle geometri kapsam ve rapor ciktilari Erzurum verisini de kapsayacak sekilde guncellendi.
- Harita arayuzunde mahalle geometri adlarinin kullanimi standartlastirildi.
- Indirme arayuzu urun odakli sadelestirme yonunde guncellendi.
- PDF basligi secilen kapsam ve detay seviyesine gore dinamik hale getirildi.
- SVG ve PNG bolge gorunumunde ic il cizgilerini gostermeyecek sekilde duzeltildi.
- Kalite notu paneli detay seviyesine gore etiket uretecek mantiga cekildi.

### Duzeltildi

- Buyuksehir illerindeki 8 mahalle adindan `Mahallesi`/`Koyu` ekleri kaldirildi; buyuksehir olmayan illerdeki bilincli ayristirmalar korundu.
- Besni geometri adlari proje standardina uyarlandi ve `15 Temmuz Sehitler` adi duzeltildi.
- Ayni isimli Zonguldak mahallelerinin baglami ve geometri adlandirmasi iyilestirildi.
- Testlerdeki sabit Windows yollarinin ve GeoPackage icin Python calistirici seciminin platform bagimliligi giderildi.
- Bursa, Edirne ve Sakarya mahalle yukleme akisindaki metadata erisim hatalari giderildi.
- SVG export XML basligi duzeltildi.
- PNG export'un bozuk SVG kaynakli hata vermesi engellendi.
- Turkce karakter bozulmalarinin onemli bolumu arayuz metinlerinden temizlendi.
