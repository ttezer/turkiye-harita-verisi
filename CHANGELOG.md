# Değişiklik Geçmişi

## [Yayınlanmamış]

### Eklendi
- Mahalle ve köy metadata pipeline'ı: e-İçişleri yerleşim listeleri normalize edilip `TR-Y-*` kimlikleriyle yayınlanıyor
- Mahalle geometri desteği: kaynak bulunan iller için mahalle seviyesinde GeoJSON ve UI filtreleri
- Mahalle kalite notları: bilinen kaynak/veri sorunları görünür filtreye göre UI'da özetleniyor
- Mahalle kaynak referansları: ham dosyalar yerine kaynak URL, erişim tarihi ve yerel dosya beklentileri tutuluyor
- Bölge (region) seviyesi: `TR-R-XXX` format ID'leri, `scope=region` desteği
- 9 dışa aktarım formatı: GeoJSON, JSON, TopoJSON, CSV, XLSX, SQL, WKT, KML, KMZ
- SVG ve PNG dışa aktarımı (seçilebilir stil, renk modu, çözünürlük)
- KML palette/auto renk modu desteği — per-feature `<Style>` üretimi
- İndirme butonunda kullanıcı geri bildirimi: "Hazırlanıyor…" / "Hata oluştu"
- Arama girişinde 160ms debounce

### Düzeltildi
- Mahalle seviyesinde bölge seçildiğinde il filtresinin bölge dışındaki ilk kaynak ile otomatik değişmesi engellendi
- KML/KMZ export'ta mahalle ölçeğinde sınırları bozan agresif koordinat sadeleştirme kaldırıldı
- **Kritik:** KML ve KMZ indirmeleri artık kullanıcının kapsam, bölge, il ve alan seçimlerini yansıtıyor (önceden statik artifact indiriliyordu)
- **Kritik:** `featureCollectionToKml` içinde metadata eşleşmesi bulunamayan feature için null crash düzeltildi
- CSV escaping: `\r` (carriage return) artık doğru quote ediliyor (`download.js` ve `export.js`)
- SQL: tablo ve sütun adları identifier quoting ile güvence altına alındı (`"tablo_adi"`)
- `simplifyKmlRing`: Douglas-Peucker 3'ten az nokta üretirse degenerate polygon yerine orijinal ring döner
- `douglasPeucker` fonksiyonu `download.js` ve `app.js` arasında duplicate'di; `app.js` artık `download.js`'den import ediyor
- `metadataLabelForFeature`: üç identik branch tek satıra indirildi
- `renderDetail`: bölge türü satırı için magic index yerine label bazlı filtre

### Kaldırıldı
- `shouldUseDirectArtifactDownload()` — artık tüm formatlar `buildDownloadBlob` üzerinden üretiliyor
- `fetchBuiltArtifactBlob()`, `getBuiltArtifactDescriptor()`, `getBuiltArtifactFilename()` — kullanılmayan dead code
- `triggerDirectDownload()` — gereksiz kaldı

### Teknik Notlar
- `.gitignore`: ham mahalle geometri dosyaları, yerleşim Excel kaynakları, `dist/`, `data/normalized/`, `data/processed/*.geojson`, `.env`, `.idea/`, OS dosyaları eklendi
- `test-ui/app.js?v=19` ve `download.js?v=19` cache-bust versiyonları eşitlendi
- `:focus-visible` global stili eklendi (klavye erişilebilirliği)
- `export.js` `toTabularRows`: eksik geometry için açıklayıcı hata mesajı
