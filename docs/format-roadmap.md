# Format Yol Haritası

Bu belge, mevcut ürün sözleşmesini ek dışa aktarım formatları için pragmatik bir yayın sırasıyla genişletir.

## Hedefler

- kanonik veri modelini kararlı tut
- coğrafi değişimi tasarım çıktılarından ayır
- 2D dışa aktarımları 3D türev varlıklardan ayır
- bir format için gerçek bir dışa aktarıcı ve smoke test var olmadan o formatı destekleniyor olarak işaretleme

## Format Aileleri

### Çekirdek Veri

- `json`
- `geojson`
- `topojson`
- `csv`
- `xlsx`
- `sql`
- `wkt`

### CBS Dağıtımı

- `shp`
- `gpkg`
- `kml`
- `kmz`

### Tasarım / Uygulama Dağıtımı

- `svg`
- `png`
- `pdf`
- `ai`
- `eps`
- `react-component`

### 3D Dağıtım

- `obj`
- `stl`
- `glb`
- `gltf`

## KKS Politikası

Önce KKS seçimini sunması gereken formatlar:

- `shp`
- `gpkg`

Önerilen ilk KKS seçenekleri:

- `WGS84 (Global)`
- `EPSG:5254 (Türkiye yerel)`

Kurallar:

- kanonik işlenmiş geometri, dışa aktarım zamanına kadar repo'nun doğrulanmış kaynak KKS akışında kalır
- projeksiyon dönüşümü yalnızca dışa aktarıcı adımlarında gerçekleşir, kanonik kaynak metadata üretiminde asla yapılmaz
- `geojson`, `topojson`, `kml` ve `kmz` varsayılan olarak WGS84 yönlü dışa aktarım davranışı sergilemelidir

## Formata Özel Notlar

### `topojson`

- `geojson`'dan sonraki en iyi coğrafi web formatıdır
- yayları paylaşır ve yük boyutunu azaltır
- zaten doğrulanmış işlenmiş geometriden üretilmelidir

### `csv` / `xlsx` / `sql`

- önce metadata çıktılarıdır
- geometri varsayılan değil isteğe bağlı olmalıdır
- geometri dahil edilecekse `geometry_wkt` sütununu tercih et

### `wkt`

- bağımsız bir dışa aktarım veya tablo formatları için geometri sütunu stratejisi olabilir
- satır başına bir özellik korunmalıdır

### `gpkg`

- tek dosya CBS dağıtımı
- shapefile yan dosya setleri istemeyecek profesyonel kullanıcılar için iyi bir hedef
- `region`, `province` ve `district` seviyeleri mevcut olduğunda ayrı katmanlar içermelidir

### `react-component`

- bu saf bir veri formatı değildir
- doğrulanmış geometri ve metadata üzerine inşa edilmiş paketlenmiş bir tüketici artifaktı olarak değerlendir
- ilk API: `scope`, `detail`, `featureProps`, `className` ve seçim callback'lerini sunmalıdır

### `ai` / `eps`

- bunları tasarım dışa aktarımları olarak değerlendir
- bu çıktılar için kanonik KKS koruması vaat etme
- doğrudan ham coğrafi çıktı yerine render güvenli vektör dışa aktarımlarından türet

### `obj`

- oyun motorları ve modelleme araçları için 3D mesh dışa aktarımı
- polygon ekstrüzyon kurallarıyla yönlendirilir

### `stl`

- baskı odaklı katı cisim dışa aktarımı
- manifold / su geçirmez çıktı kuralları gerektirir
- `base_thickness`, `extrusion_height` ve birim politikasını açıklamalıdır

### `glb` / `gltf`

- çalışma zamanı odaklı 3D sahne formatları
- web'de 3D Türkiye haritası gömmek için uygundur
- mümkün olan yerlerde `obj` ile aynı geometri türetme pipeline'ını paylaşmalıdır

## Yayın Sırası

Bu proje her çıktı formatını tek bir geçişte üretmeye çalışmamalıdır.

Önerilen uygulama sırası:

### Faz A

- `topojson`
- `csv`
- `xlsx`
- `sql`
- `wkt`

### Faz B

- `gpkg`
- `kml`
- `kmz`
- `shp`

### Faz C

- `svg`
- `png`
- `pdf`
- `react-component`
- `ai`
- `eps`

### Faz D

- `obj`
- `stl`
- `glb`
- `gltf`

## KKS Yayın Sırası

Ürün yüzeyinde ilk KKS seçimini sunması gereken formatlar:

- `shp`
- `gpkg`

İlk KKS seçenekleri:

- `WGS84 (Global)`
- `EPSG:5254 (Türkiye yerel)`

## Destek Kuralı

Bir format ancak aşağıdakilerin tamamı mevcut olduğunda destekleniyor sayılır:

- deterministik bir dışa aktarıcı
- çıktı adlandırma kuralı
- smoke test kapsamı
- formata özel doğrulama kuralları
- net arayüz kullanılabilirlik mantığı

## Bekleyen QA Notları

İndirme yapılandırıcısı hâlâ format format manuel tarayıcı doğrulamasına ihtiyaç duymaktadır.

Bir sonraki QA turunda şu an açık olan her format ayrı ayrı kontrol edilmelidir:

- indirme butonu gerçek bir dosya indirimi tetikliyor mu
- indirilen dosya adı doğru mu
- yük seçilen `scope` / `detail`'e uyuyor mu
- alanlar ve geometri beklenen formatta kodlanmış mı

İndirme butonu arayüzü de odaklanmış bir etkileşim turuna ihtiyaç duymaktadır:

- daha belirgin bir hover rengi/durum değişimi ekle
- tık / aktif geri bildirim durumu ekle
- devre dışı ile planlanan görünümün görsel olarak belirgin olduğunu doğrula
