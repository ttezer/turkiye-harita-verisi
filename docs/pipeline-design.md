# Pipeline Tasarımı

## Kaynak Karşılaştırması

### Aday Geometri Kaynakları

| Kaynak | Lisans | Format | İl / ilçe kapsamı | Güncellik / bakım | Güçlü yönler | Zayıf yönler |
| --- | --- | --- | --- | --- | --- | --- |
| HDX COD-AB Türkiye | CC BY-IGO | GeoJSON zip, SHP zip, GDB zip, XLSX | ADM1 ve ADM2 | CKAN metadata 2026-04-07 güncellendi; kaynak dosyalar 2026-01-26 güncellendi; veri aralığı 2022-01-01 – 2025-01-16 | Mevcut en iyi pratik Türkiye idari paketi; kararlı `adm1_pcode`/`adm2_pcode`, ebeveyn bağlantısı, santroid alanları ve doğrudan ADM1/ADM2 katmanları içeriyor | Edinim yerel anlık görüntü olarak sabitlenmeli; bazı alanlar çok dilli kopyalar veya kanonik metadata yerine yayın metadata'sı |
| geoBoundaries TUR ADM1/ADM2 | Yukarı akış OSM kaynaklı; Türkiye metadata'sı katmanlar arasında karışık lisanslama sinyalleri gösteriyor, yalnızca açık atıf incelemesiyle satıcılanmalı | GeoJSON, TopoJSON, zip demetleri | ADM1 ve ADM2 | Türkiye ADM1/ADM2 derleme tarihi 2023-12-12 | Makine okunabilir, sabitlenmiş statik indirmeler, doğrudan GeoJSON erişimi | ADM2 Türkiye ilçelerini fazla sayıyor görünüyor; ADM2 feature'ları ebeveyn il kimliği taşımıyor |
| GADM 4.x | Yeniden dağıtım ve ticari kullanım kısıtlamaları birincil geometri olarak kullanımını uygunsuz kılıyor | GeoJSON, GeoPackage, Shapefile ve diğerleri | ADM1 ve ADM2+ | Aktif olarak yayınlanıyor | Zengin nitelikler, doğrudan ebeveyn referansları | Lisansı açık dağıtılabilir bir repo için kabul edilemez |
| OSM / Geofabrik | ODbL 1.0 | PBF, OSM XML, shapefile türevleri | ADM1 ve ADM2 çıkarılabilir | Çok güncel; Geofabrik düzenli yayınlıyor | En iyi ham güncellik, güçlü ilişki ekosistemi, geometri çapraz kontrolü için iyi | Yerel çıkarma mantığı ve ilişki QA gerektiriyor |
| Natural Earth | Kamu malı | Shapefile | Yalnızca il benzeri birinci seviye | Bakımlı | Mükemmel lisans, kolay yeniden kullanım | İlçe kapsamı yok |
| Resmi HGK / kamuya açık sınır indirmeleri | Kamuya erişim bildirildi ama açık lisans tutumu belirsiz | SHP ailesi | İl ve ilçe benzeri idari katmanlar bildirildi | Resmi provenance güçlü | Potansiyel olarak yetkili | Lisans belirsizliği repo birincil kaynağı için çok riskli |

### Önerilen Kaynaklar

- `Birincil geometri kaynağı`: HDX COD-AB Türkiye, `source/hdx/cod-ab-tur/` altında sabitlenmiş anlık görüntü olarak satıcılanmış
- `Referans kaynak`: geoBoundaries TUR ADM1 + ADM2, ikincil geometri çapraz kontrolü olarak kullanılıyor
- `Referans kaynak`: İl düzeyinde `nuts_code` için TÜİK İBBS / NUTS tabloları
- `Referans kaynak`: İl düzeyinde `iso_3166_2` için ISO 3166-2:TR
- `Referans kaynak`: `icisleri_id` için İçişleri Bakanlığı / MİB tabloları
- `Referans kaynak`: `osm_relation_id` için OSM ilişki metadata tablosu
- `Yalnızca doğrulama kaynağı`: UAB `ilce-listesi.xlsx`
- `Deneysel çıkarıcı kaynak`: `e-icisleri` Mülki İdari Bölümleri sayfası
- `Yalnızca araştırma kaynağı`: NVI Adres Kayıt Sistemi kamuya açık sayfaları

## HDX'in Birincil Kaynak Olarak Seçilmesi

- Doğrudan CKAN API metadata ve indirilebilir kaynak URL'leri sunuyor.
- Veri seti tek tutarlı pakette hem ADM1 hem ADM2 içeriyor.
- `adm1_pcode` ve `adm2_pcode` yukarı akış kaynak anahtarları olarak kullanmaya yeterince benzersiz ve kararlı.
- İlçe `adm2_pcode` değerleri `adm1_pcode`'larına önek bağlantılı ve son üç hanesi her il içinde zaten sıralı.
- Bu nedenle ham geometri örtüşmelerinden ebeveyn bağlantısı kurmaktan daha iyi bir deterministik giriş.

## Gerçek HDX Kaynak İncelemesi

CKAN metadata doğrulandı:

- veri seti: `cod-ab-tur`
- başlık: `Türkiye - Subnational Administrative Boundaries`
- lisans: `CC BY-IGO`
- kaynaklar: `GeoJSON`, `SHP`, `Geodatabase`, `XLSX`

GeoJSON paketi içeriği:

- `tur_admin0.geojson`
- `tur_admin1.geojson`
- `tur_admin2.geojson`
- `tur_adminlines.geojson`
- `tur_adminpoints.geojson`

Gözlemlenen sayılar:

- `tur_admin1.geojson`: `81` feature
- `tur_admin2.geojson`: `973` feature

Gözlemlenen HDX birincil benzeri anahtarlar:

- il yukarı akış anahtarı: `adm1_pcode`
- ilçe yukarı akış anahtarı: `adm2_pcode`

Doğrulanan özellikler:

- `adm1_pcode` tüm 81 ilde benzersiz
- `adm2_pcode` tüm 973 ilçede benzersiz
- her `adm2_pcode` ebeveyn `adm1_pcode`'uyla başlıyor
- `adm2_pcode`'un son üç hanesi her il içinde aralıksız ve sıralı

Yani HDX zaten deterministik il-içi ilçe sıralaması taşıyor. Kanonik kimlikler üretirken bunu kaynak mirasını olarak koruyabiliriz.

## Kaynak Alan Eşlemesi

### Birincil Eşleme: HDX ADM1

Gözlemlenen kaynak özellikleri:

```json
{
  "adm1_name": "Adana",
  "adm1_name1": "Adana",
  "adm1_pcode": "TUR001",
  "adm0_name": "Türkiye",
  "adm0_pcode": "TUR",
  "valid_on": "2022-01-01",
  "valid_to": null,
  "area_sqkm": 13826.83745205,
  "version": "v01",
  "lang": "en",
  "lang1": "tr",
  "center_lat": 37.47297957,
  "center_lon": 35.36894826
}
```

| Kaynak alan | Hedef alan | Kural |
| --- | --- | --- |
| Varsa `adm1_name1`, yoksa `adm1_name` | `name` | Mümkünse Türkçe görüntüleme formunu tercih et |
| Varsa `adm1_name1`, yoksa `adm1_name` | `name_ascii` | Deterministik Türkçe karakter dönüşümü ve küçük harf |
| Varsa `adm1_name1`, yoksa `adm1_name` | `slug` | Boşluklar `-` ile değiştirilmiş normalleştirilmiş `name_ascii` |
| `adm1_pcode` | `source_hdx_id` | Tam yukarı akış kaynak kimliğini koru, örn. `TUR001` |
| `adm1_pcode` | `plate_code` | Son üç haneyi tam sayıya çevir ve sıfır dolgulu iki hane olarak yeniden biçimlendir, örn. `001 -> 01` |
| `adm1_pcode` | `id` | Plaka kodundan kanonik kimlik türet: `TR-P-XX` |
| sabit | `level` | `province` |
| düzenlenmiş bölge üyeliği | `parent_id` | Ebeveyn coğrafi bölge kimliğine ayarla, örn. `TR-R-MRM` |
| düzenlenmiş bölge üyeliği | `region_id` | İller için `parent_id` ile aynı değer |
| düzenlenmiş bölge üyeliği | `region_name` | İnsan tarafından okunabilir coğrafi bölge adı |
| yok | `aliases` | Varsayılan `[]`; yalnızca düzenlenmiş takma adlar |
| yok | `district_local_code` | İller için `null` |
| yok | `iso_3166_2` | İl çapraz tablosundan birleştir |
| yok | `nuts_code` | TÜİK il çapraz tablosundan birleştir |
| yok | `tuik_id` | İl çapraz tablosundan birleştir |
| yok | `icisleri_id` | İçişleri Bakanlığı / MİB il çapraz tablosundan birleştir |
| yok | `osm_relation_id` | OSM eşleme tablosundan isteğe bağlı birleştir |
| `center_lat`, `center_lon` | `centroid` | Kaynak değerleri doğrudan kullan veya geometri düzeltmesi uygulanırsa yeniden hesapla |
| geometri | `bbox` | Polygon geometrisinden `[min_lon, min_lat, max_lon, max_lat]` dizisini hesapla |

Kullanışlı ama kanonik değil:

- `valid_on`
- `valid_to`
- `version`
- `area_sqkm`

Kanonik dışa aktarımdan çıkar:

- `adm0_name`, `adm0_name1`, `adm0_name2`, `adm0_name3`
- `lang`, `lang1`, `lang2`, `lang3`
- null olduğunda gereksiz alternatif dil yer tutucuları

### Birincil Eşleme: HDX ADM2

Gözlemlenen kaynak özellikleri:

```json
{
  "adm2_name": "Aladag",
  "adm2_name1": "Aladağ",
  "adm2_pcode": "TUR001001",
  "adm1_name": "Adana",
  "adm1_name1": "Adana",
  "adm1_pcode": "TUR001",
  "adm0_name": "Türkiye",
  "adm0_pcode": "TUR",
  "valid_on": "2022-01-01",
  "valid_to": null,
  "area_sqkm": 1340.44943134,
  "version": "v01",
  "center_lat": 37.53350658,
  "center_lon": 35.30918714
}
```

| Kaynak alan | Hedef alan | Kural |
| --- | --- | --- |
| Varsa `adm2_name1`, yoksa `adm2_name` | `name` | Mümkünse Türkçe görüntüleme formunu tercih et |
| Varsa `adm2_name1`, yoksa `adm2_name` | `name_ascii` | Deterministik Türkçe karakter dönüşümü ve küçük harf |
| ilçe adı + ebeveyn il slug'ı | `slug` | `${name_ascii}-${province_slug}` |
| `adm2_pcode` | `source_hdx_id` | Tam yukarı akış kaynak kimliğini koru, örn. `TUR001001` |
| `adm1_pcode` | `plate_code` | Ebeveyn pcode sonekini iki haneli plaka koduna çevir |
| `adm2_pcode` | `district_local_code` | Son üç haneyi doğrudan kullan, örn. `001` |
| `adm1_pcode` | `parent_id` | Ebeveyn pcode'u kanonik il kimliğine çevir |
| `adm1_pcode` + `adm2_pcode` soneki | `id` | Kanonik `TR-D-XX-YYY`; `XX` ebeveyn plaka kodundan, `YYY` pcode sonekinden |
| sabit | `level` | `district` |
| yok | `aliases` | Varsayılan `[]`; yalnızca düzenlenmiş takma adlar |
| sabit | `iso_3166_2` | İlçeler için `null` |
| yok | `lau_code` | Temiz bire-bir kamuya açık referans olmadan doldurma |
| yok | `tuik_id` | Temiz bire-bir kamuya açık referans olmadan doldurma |
| yok | `icisleri_id` | Temiz bire-bir kamuya açık referans olmadan doldurma |
| yok | `osm_relation_id` | OSM eşleme tablosundan isteğe bağlı birleştir |
| `center_lat`, `center_lon` | `centroid` | Kaynak değerleri doğrudan kullan veya geometri düzeltmesi uygulanırsa yeniden hesapla |
| geometri | `bbox` | Polygon geometrisinden `[min_lon, min_lat, max_lon, max_lat]` dizisini hesapla |

Kullanışlı ama kanonik değil:

- `valid_on`
- `valid_to`
- `version`
- `area_sqkm`

Kanonik dışa aktarımdan çıkar:

- `adm0_name`, `adm0_name1`, `adm0_name2`, `adm0_name3`
- `lang`, `lang1`, `lang2`, `lang3`
- ebeveyn bağlama tamamlandıktan sonra gereksiz `adm1_name*` değerleri

İlçe referans politikası:

- `UAB ilce-listesi.xlsx` yalnızca doğrulama amaçlıdır; havalimanları ve belirsiz `MERKEZ` satırları gibi ilçe olmayan satırlar içermektedir.
- `e-icisleri`, gelecekteki ilçe admin kimlikleri için en güçlü kamuya açık adaydır; ancak çıkarma şu an deneysel olup build'in parçası değildir.
- `adres.nvi.gov.tr` kamuya açık sayfalar ve istemci taraflı adres kavramları sunmaktadır; ancak kararlı bir kamuya açık ilçe ana araması doğrulanmamıştır.
- İlçe `tuik_id`, `icisleri_id` ve `lau_code` alanları, tekrarlanabilir bire-bir birleştirme doğrulanmadan `null` kalmalıdır.

## Dönüşüm Kuralları

### `name_ascii`

Deterministik Türkçe karakter dönüşümü uygula:

- `ç -> c`
- `ğ -> g`
- `ı -> i`
- `ö -> o`
- `ş -> s`
- `ü -> u`
- büyük harf varyantları aynı şekilde dönüştürülür

Ardından:

- Unicode'u NFKD olarak normalleştir
- birleştirme işaretlerini bırak
- iç boşlukları kapat
- kırp
- küçük harfe çevir

### `slug`

Kurallar:

- il için `slug = name_ascii`
- ilçe için `slug = ${name_ascii}-${province_slug}`
- boşlukları `-` ile değiştir
- tekrarlanan `-` karakterlerini daralt
- yalnızca `[a-z0-9-]` karakterleri tut

### Ebeveyn Türetme

İlçeler geoBoundaries'de il kimliği taşımıyor. Ebeveyn il şu şekilde atanmalıdır:

1. `adm1_pcode`'dan ebeveyni türet
2. `adm2_pcode`'un `adm1_pcode` ile başladığını doğrulayarak ilişkiyi kontrol et
3. doğrulama sırasında isteğe bağlı olarak geometri kapsama çapraz kontrolü yap

## Pipeline Aşamaları

## Çalışma Zamanı Sınırı

Mevcut çalışma zamanı sınırı kasıtlı ama geçicidir:

- `Node.js`: kanonik derleme yoluna sahip — normalleştirme, deterministik kimlik ataması, doğrulama, dışa aktarım, test arayüzü sunumu ve smoke testleri.
- `Python`: şu an yalnızca il çapraz tablosu üretimi ve görüntüleme adı geçersiz kılmaları gibi harici veri setlerini zenginleştiren veya inceleyen referans veri yardımcı betiklerle sınırlı.
- `npm run build`, iki referans üretim adımı kanonik Node işleme aşamalarından önce Python'da çalıştığından bugün her iki çalışma zamanını da gerektirmektedir.

Operasyonel kural:

- bir betik kanonik `data/processed/*` veya `dist/*` artifaktları üretiyorsa Node tarafında yer alır
- bir betik araştırıyor, inceliyor veya isteğe bağlı referans tabloları ön hesaplıyorsa mantığı dondurulana kadar Python tarafında kalabilir

Yakın vadeli yön:

- kanonik yayın pipeline'ını Node'da kararlı tut
- Python referans üreticilerini mantıkları birleştirmeyi haklı kılacak kadar dondurulduğunda aşamalı olarak geçir

### Ham

Amaç:

- satıcılanmış kaynak anlık görüntülerini tam olarak indirildiği şekilde sakla
- edinimi tekrarlanabilir ve incelenebilir tut

Dosyalar:

- `source/hdx/cod-ab-tur/tur_admin_boundaries.geojson.zip`
- `source/hdx/cod-ab-tur/tur_admin_boundaries.xlsx`
- `source/hdx/cod-ab-tur/manifest.json`
- `source/reference/provinces.crosswalk.json`
- `source/reference/districts.crosswalk.json`
- `source/reference/regions.geographic-7.json`
- `source/reference/ilce-listesi.xlsx`
- `source/reference/uab-validation-report.json`
- `source/reference/e-icisleri-provinces.snapshot.json`
- `source/reference/nvi-surface-report.json`
- `source/reference/tuik-ibbs-provinces.csv`
- `source/reference/mib-provinces.csv`
- `source/reference/mib-districts.csv`
- `source/reference/osm-relations-provinces.json`
- `source/reference/osm-relations-districts.json`
- isteğe bağlı `source/reference/geoboundaries/` doğrulama anlık görüntüsü

### Normalleştirilmiş

Amaç:

- kimlikler atanmadan önce her kaynağı kararlı bir iç şekle dönüştür

Dosyalar:

- `data/normalized/provinces.geometry.geojson`
- `data/normalized/provinces.metadata.partial.json`
- `data/normalized/districts.geometry.geojson`
- `data/normalized/districts.metadata.partial.json`
- `data/normalized/ingest-report.json`

Kurallar:

- metadata ve geometri ayrı kalır
- tüm stringler kırpılır
- geometri özellikleri yalnızca sonraki birleştirmeler için gereken kaynak provenance alanlarını taşır
- henüz nihai kimlikler yok

### İşlenmiş

Amaç:

- deterministik kimlikler ata
- referans tablolarını birleştir
- santroid, bbox ve slug hesapla
- kanonik nesneleri doğrula

Dosyalar:

- `data/processed/regions.metadata.json`
- `data/processed/provinces.metadata.json`
- `data/processed/provinces.geometry.geojson`
- `data/processed/regions.geometry.geojson`
- `data/processed/districts.metadata.json`
- `data/processed/districts.geometry.geojson`
- `data/processed/build-report.json`

### Dist

Amaç:

- tüketici dostu çıktıları yayınla

Dosyalar:

- `dist/json/regions.json`
- `dist/json/provinces.json`
- `dist/json/districts.json`
- `dist/geojson/regions.geojson`
- `dist/geojson/provinces.geojson`
- `dist/geojson/districts.geojson`
- `dist/topojson/*.topojson`
- `dist/csv/*.csv`
- `dist/xlsx/turkiye-map.xlsx`
- `dist/sql/*.sql`
- `dist/wkt/*.wkt`
- `dist/kml/*.kml`
- `dist/kmz/*.kmz`
- `dist/shp/*.zip`

## Script Sözleşmesi

### `scripts/ingest.js`

- gerekli ham dosyaların var olduğunu doğrula
- HDX CKAN metadata'sını getir veya sabitlenmiş kaynak URL'lerini kullan
- seçili kaynakları `source/hdx/cod-ab-tur/` içine indir
- `source/hdx/cod-ab-tur/manifest.json` dosyasından sağlama toplamlarını doğrula
- ham kaynak dosyaları bilinen bir çalışma şekline kopyala veya aç
- `data/normalized/ingest-report.json` üret

### `scripts/normalize.js`

- ham geometri kaynağını oku
- kaynak alanlarını kanonik kısmi metadata'ya eşle
- `name`, `name_ascii`, ham geometri provenance'ını ve kaynak parmak izlerini hesapla
- `tuik_id` ve `icisleri_id`'yi ayrı sütunlar olarak tut
- `source_hdx_id`'yi koru
- nihai kimlikler olmadan normalleştirilmiş geometri koleksiyonları üret

### `scripts/assign-ids.js`

- düzenlenmiş coğrafi-7 bölge referansını yükle
- normalleştirilmiş il ve ilçe veri setlerini yükle
- bölge kimliklerini ve il-bölge üyeliğini ata
- topoloji birleştirme yoluyla il geometrisini bölge sınırlarına eritir
- plaka kodundan il kimliklerini ata
- `adm1_pcode`'dan ilçe ebeveyn ilini türet
- deterministik ilçe yerel sırası için `adm2_pcode` sonekini kullan
- `district_local_code`, `id`, `parent_id`, `region_id` ve `slug` ata

### `scripts/validate.js`

- işlenmiş metadata'yı JSON Şemasına karşı doğrula
- `id` benzersizliğini doğrula
- `slug` benzersizliğini doğrula
- `source_hdx_id` benzersizliğini doğrula
- her il `parent_id`'sinin bölgelerde var olduğunu doğrula
- her ilçe `parent_id`'sinin illerde var olduğunu doğrula
- her ilçe `region_id`'sinin ebeveyn iliyle eşleştiğini doğrula
- her ilçe `source_hdx_id`'sinin ebeveyn il `source_hdx_id`'siyle başladığını doğrula
- geometri özellik sayısının metadata sayısıyla eşleştiğini doğrula
- `properties.id` üzerinde bire-bir birleştirmeyi doğrula
- ilçe sıralamasının her il için deterministik ve aralıksız olduğunu doğrula
- `crosswalk-report.json` üzerinden ilçe çapraz tablo zenginleştirme sayılarını doğrula

### `scripts/export.js`

- nihai tüketici çıktılarını `dist/` altına yaz
- kanonik olmayan derleme zamanı yardımcı alanlarını çıkar
- geometri özelliklerini yalın tut: `id`, `parent_id`, `level`

## Deterministik Kimlik Kuralları

### İl Kimliği

Format:

- `TR-P-XX`

Kural:

- `XX` sıfır dolgulu il plaka kodudur
- örnek: `06 -> TR-P-06`
- yukarı akış kaynağı `source_hdx_id` içinde kalır, örn. `TUR006`

### İlçe Kimliği

Format:

- `TR-D-XX-YYY`

Kural:

- `XX` ebeveyn il plaka kodudur
- `YYY` ilçenin il içindeki deterministik sırasıdır
- HDX birincil kaynak olduğunda `YYY`, `adm2_pcode`'un son üç hanesinden alınır

Kararlı sıralama anahtarı:

1. `adm2_pcode` soneki
2. `name_ascii`
3. `tuik_id`
4. `icisleri_id`

Örnek:

- `34` ilindeki ilk sıralı ilçe `TR-D-34-001` olur

### `parent_id`

Kural:

- her il, ebeveyn coğrafi bölgenin `id`'sini alır
- her ilçe, `adm1_pcode` tarafından belirlenen ilin `id`'sini alır

## Küçük Örnek Veri Seti

`data/processed/*.sample.*` içindeki örnek veri seti şunları kullanır:

- iller: Ankara, İstanbul, İzmir
- ilçeler: Altındağ, Çankaya, Adalar, Beşiktaş, Konak, Karşıyaka

Bu örnek şunları gösterir:

- kararlı il ve ilçe kimlikleri
- benzersiz URL dostu slug'lar
- ayrı metadata ve geometri dosyaları
- yalın geometri özellikleri
- ayrı `tuik_id` ve `icisleri_id` yuvaları

## Kaynaklar

- [geoBoundaries TUR ADM1 API](https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM1/)
- [geoBoundaries TUR ADM2 API](https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM2/)
- [GADM verisi](https://gadm.org/data.html)
- [GADM lisansı](https://gadm.org/license.html)
- [OpenStreetMap lisansı](https://www.openstreetmap.org/copyright)
- [Geofabrik indirmeleri](https://www.geofabrik.de/de/data/download.html)
- [Natural Earth admin-1 verisi](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/)
- [Natural Earth kullanım koşulları](https://www.naturalearthdata.com/about/terms-of-use/)
- [HDX COD-AB Türkiye veri seti sayfası](https://data.humdata.org/dataset/cod-ab-tur)
- [Open Knowledge Foundation HGK sınır indirmeleri notu](https://index.okfn.org/place/tr/boundaries.html)
