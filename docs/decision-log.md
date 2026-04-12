# Decision Log

Bu belge, proje boyunca gelen teknik geri bildirimlerin hangi kısmının kabul edildiğini, hangisinin ertelendiğini ve hangi konuların netleştirildiğini kaydeder.

## 2026-04-10

### Konu

İki ayrı teknik ön incelemenin değerlendirilmesi ve proje yönünün netleştirilmesi.

### Bağlam

Projede şu anda:

- HDX ana geometri kaynağı olarak kullanılmaktadır.
- İl ve ilçe sınırları normalize edilmekte, deterministic ID atanmaktadır.
- Metadata ve geometry ayrı tutulmaktadır.
- `dist/json` ve `dist/geojson` çıktıları üretilmektedir.
- Test UI, bu çıktıların görsel doğrulaması için kullanılmaktadır.

Ek not:

- HDX sürekli canlı kaynaktan tüketilmeyecektir.
- Snapshot yaklaşımı kullanılmaktadır.
- İl ve ilçe sınırları sık değişmediği için bu model kabul edilmiştir.

### Gözden Geçirilen Görüşler

İki ayrı dış değerlendirme incelendi:

1. Veri hattı, ID standardı ve test UI üzerine odaklanan ilk teknik göz.
2. Mimari, runtime karması, dokümantasyon ve repo yapısı üzerine odaklanan ikinci teknik göz.

### Kabul Edilen Tespitler

#### 1. Deterministic ID politikası doğrudur

Kabul edildi.

Gerekçe:

- `TR-P-XX` ve `TR-D-XX-YYY` formatı okunabilir, stabil ve geliştirici dostudur.
- İsimleri canonical key yapmamak doğru karardır.
- Türkçe karakter, isim değişikliği ve kaynaklar arası eşleştirme riskini azaltır.

#### 2. Geometry ve metadata ayrımı korunmalıdır

Kabul edildi.

Gerekçe:

- İstemciler yalnız ihtiyaç duydukları veriyi çekebilir.
- Sadece sorgu yapan taraf geometry indirmez.
- Sadece harita çizen taraf tam metadata taşımak zorunda kalmaz.

#### 3. Pipeline sırası doğrudur

Kabul edildi.

Geçerli sıra:

1. Normalize
2. Assign IDs
3. Validate
4. Export

#### 4. Çoklu referans alanları gereklidir

Kabul edildi.

Gerekçe:

- `tuik_id`, `icisleri_id`, `osm_relation_id`, `nuts_code`, `lau_code` gibi alanlar canonical kimlik değildir.
- Ama resmi ve yarı resmi kaynaklarla crosswalk kurmak için gereklidir.

#### 5. Test UI’nin varlığı doğrudur

Kabul edildi.

Gerekçe:

- Bu sayfa ürün değil, görsel smoke test ve veri QA yüzeyidir.
- Geometri render sorunları bu sayede erken fark edilmiştir.

#### 6. Hata yönetimi güçlendirilmeli

Kabul edildi.

Gerekçe:

- Test UI’de veri yükleme hataları kullanıcıya daha açık gösterilmelidir.
- Ancak hata sessizce yutulmamalıdır.

### Kısmen Kabul Edilen Tespitler

#### 7. Arama için debounce eklenebilir

Kısmen kabul edildi.

Karar:

- İleride eklenebilir.
- Şu an veri hacmi için kritik değildir.
- Öncelik doğruluk, sözleşme ve export kalitesindedir.

#### 8. Python + Node.js karışımı bakım yükü oluşturur

Kısmen kabul edildi.

Karar:

- Tespit doğrudur.
- Ancak şu an Python’un pratik faydası vardır:
  - Excel okuma
  - yardımcı reference scriptleri
  - hızlı crosswalk üretimi
- Kısa vadede zorunlu göç yapılmayacaktır.
- Uzun vadede şu iki modelden biri seçilmelidir:
  - tek runtime
  - ya da `core build = Node`, `research helpers = Python`

### Reddedilen veya Aynen Alınmayan Öneriler

#### 9. `Promise.all(...).catch(() => [])` ile UI hatasını yumuşatmak

Reddedildi.

Gerekçe:

- Bu yaklaşım hata yüzeyini gizler.
- Uygulama yanlış veri yapısıyla çalışmaya devam edebilir.
- Daha doğru yaklaşım:
  - açık hata durumu üretmek
  - kullanıcıya net mesaj göstermek
  - render akışını güvenli biçimde durdurmak

### Netleştirilen Teknik Konular

#### 10. HDX kullanım şekli

Netleştirildi.

Karar:

- HDX canlı runtime bağımlılığı değildir.
- Snapshot olarak yerelde vendorlanır.
- Build bu snapshot üzerinden çalışır.
- İl ve ilçe sınırları sık değişmediği için bu yaklaşım uygundur.

#### 11. HDX dışı kaynakların rolü

Netleştirildi.

Mevcut durum:

- `HDX`: primary geometry source
- `GISCO / NUTS`: province reference source
- `UAB ilce-listesi.xlsx`: validation-only ve kontrollü display-name helper
- `e-İçişleri`: araştırma / extractor adayı
- `NVI`: research-only

Karar:

- `NVI` ve `e-İçişleri` şu an build input değildir.
- Uygun ve reproducible extractor olmadan canonical pipeline’a alınmazlar.

#### 12. `bbox` ve `centroid` konumu

Netleştirildi.

Karar:

- `bbox` ve `centroid` metadata tarafında tutulur.
- Geometry dosyası mümkün olduğunca lean kalır.

#### 13. `packages/` klasörünün rolü

Netleştirildi.

Karar:

- `packages/` gelecekte tüketim katmanıdır.
- Özellikle JS tüketimi için düşünülmektedir.
- Yayın/publish stratejisi henüz kesinleştirilmemiştir.

#### 14. `dist/svg` ve `dist/topojson` beklentisi

Netleştirildi.

Karar:

- Bu klasörler nihai yönü işaret eder.
- Fiili üretim kapsamı bugün:
  - `json`
  - `geojson`
  - `topojson`
  - `csv`
  - `xlsx`
  - `sql`
  - `wkt`
  - `kml`
  - `kmz`
- `svg` ve `png` şu anda UI tabanlı export olarak hazırdır.
- `pdf` ve diğer zengin formatlar sonraki ürünleşme katmanında ele alınacaktır.

### Açık Kararlar

Henüz tamamlanmamış ama izlenecek başlıklar:

- Lisansın netleştirilmesi
- `packages/` yayın stratejisinin belirlenmesi
- format / scope / detail / style / resolution ürün sözleşmesinin yazılması
- district reference alanlarının güvenilir kaynaklarla doldurulması
- repo içi relative dokümantasyon linklerinin gözden geçirilmesi

### Sonuç

Her iki teknik görüş de genel olarak aynı ana sonuca işaret etmektedir:

- Projenin veri modeli sağlamdır.
- Deterministic ID yaklaşımı doğru karardır.
- Metadata / geometry ayrımı korunmalıdır.
- Asıl risk veri sözleşmesinden çok dokümantasyon borcu, lisans netliği ve runtime sınırlarının açık yazılmamasıdır.

Bu doğrultuda proje yönü teyit edilmiştir:

- çekirdek ürün: Türkiye idari sınırlar veri altyapısı
- test UI: doğrulama ve demo yüzeyi
- sonraki katman: seçilebilir formatlarla harita üretim/export sistemi
