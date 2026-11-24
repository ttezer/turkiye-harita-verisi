# Mahalle Geometrisi ve OSB Standardı

Bu dosya ilçe bazlı mahalle/köy geometri üretimlerinde uyulacak proje standardıdır. Yeni il verisi hazırlanırken önce bu dosya, ardından `scripts/normalize-mahalle-geometrileri.js` okunur.

## Kaynak ve kapsam

- Resmî yerleşim referansı: `dist/json/yerlesimler.json`.
- `type: "mahalle"` ve `type: "koy"` kayıtları mülki idare referansındaki resmî sayımlardır.
- Kaynak geometrisinde bulunup resmî listede bulunmayan alanlar resmî mahalle/köy toplamına eklenmez; raporda `source_only` olarak ayrıca gösterilir.
- Görüntüleme ve dışa aktarma katmanı ilçe bazlıdır. KML/KMZ içinde OSB için ayrı bir ilçe/klasör açılmaz.

## İsimlendirme

- Standart gösterim adında sondaki `Mahallesi` ve `Köyü` eki kullanılmaz: `Kızıldağ Köyü` → `Kızıldağ`.
- Türkçe karakterler korunur.
- Kısaltmalar ve OSB adı korunur: `Bolvadin Osb` → `Bolvadin OSB`.
- Aynı ilçede aynı ad farklı yerleşim türlerinde bulunuyorsa tür bilgisi ID ve `type` alanından ayrıştırılır; ad keyfî olarak değiştirilmez.

## ID ve tür standardı

İl plaka kodu iki haneli, ilçe sıra numarası üç hanelidir:

- Mahalle: `TR-Y-<PLAKA>-<İLÇE_SIRA>-M-<4 hane>`
- Köy: `TR-Y-<PLAKA>-<İLÇE_SIRA>-K-<4 hane>`
- OSB/sanayi alanı: `TR-Y-<PLAKA>-<İLÇE_SIRA>-OSB-<BÜYÜK_HARF_COMPACT_AD>`

OSB kaydı:

- aynı ilçe katmanında/klasöründe yer alır;
- `type: "osb"`, `osb: true`, `source_only: true` alanlarını taşır;
- `parent_id` ve `district_id` ilgili ilçeyi gösterir;
- resmî mahalle/köy sayımına dahil edilmez;
- raporda `osb_areas` altında listelenir.

Örnek: `Bolvadin OSB` → `TR-Y-03-004-OSB-BOLVADINOSB`.

## QC zorunlulukları

Her il çıktısında en az şu kontroller yapılır:

- ilçe bazında referans mahalle/köy sayısı ile geometri sayısının karşılaştırılması;
- aynı ilçe ve aynı tür içinde mükerrer ad kontrolü;
- mükerrer geometri, boş/bozuk geometri ve kapanmamış halka kontrolü;
- şüpheli örtüşme ve çok parçalı geometri listesi;
- ID formatı, ID benzersizliği ve `M`/`K`/`OSB` türlerinin doğrulanması;
- kaynakta olup referansta olmayan OSB/sanayi alanlarının resmî sayımdan ayrı raporlanması.

QC sonucunda düzeltilen geometri veya adlar raporda açıkça belirtilir. Örneğin Afyonkarahisar çıktısında `Yarımca` adı, `Yakasinek` tek büyük poligon olarak ve beş OSB proje standardına göre işlenmiştir.

Kullanıcı tarafından sağlanan düzeltme KMZ/KML'si varsa, geometri kaynağı ve uygulanan parça aktarımı rapora yazılır. Afyonkarahisar özel düzeltmesinde `Battalgazi [2Polygon].kmz` içindeki ikinci poligon Battalgazi'den çıkarılmış, `Yarımca.kmz` poligonu ile birleştirilerek `Yarımca` adlı iki parçalı `MultiPolygon` olarak tutulmuştur; Battalgazi'de ilk poligon bırakılmıştır.
