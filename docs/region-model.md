# Bölge Modeli

Bu belge, `region` seviyesinin mevcut il ve ilçe modelini bozmadan nasıl ekleneceğini tanımlar.

## Öneri

`region`'ı il üzerine ekle:

- `region -> province -> district`

Region'ı il ile ilçe arasına yerleştirme.

## Neden

- mevcut ilçe-ebeveyn ilişkisi zaten doğru ve kullanışlı
- birleştirmeler, filtreler ve aramalar `district.parent_id = province.id` bağlantısına dayanıyor
- region, operasyonel bir ilçe ebeveyni değil, bir toplama katmanıdır

## Kanonik Kurallar

### Bölge

- `level = region`
- `parent_id = null`
- bölge satırları açık bir bölge üyelik politikasından türetilir

Önerilen alanlar:

- `id`
- `name`
- `name_ascii`
- `slug`
- `region_kind`
- `member_ids`
- `centroid`
- `bbox`

### İl

- `level = province`
- bölge modu etkinleştirildiğinde `parent_id = region.id`
- il, ilçenin kanonik ebeveyni olmaya devam eder

### İlçe

- `level = district`
- `parent_id = province.id`
- `region_id` türetilmiş bir kolaylık alanı olarak eklenebilir

## İlk Bölge Sistemi

Önerilen ilk `region_kind`:

- `geographic-7`

`geographic-7` için referans notu:

- bu gruplandırma, düzenlenmiş bir referans katmanı olarak değerlendirilmelidir
- repo, 6-21 Haziran 1941'de Ankara'da toplanan Birinci Coğrafya Kongresi'nde belirlenen yedi coğrafi bölgeyi temel aldığını belirtmelidir
- üyelik, çalışma zamanında çıkarılmak yerine yerel bir referans dosyasında açıkça saklanmalıdır

İlk bölge örnekleri:

- `Marmara`
- `Ege`
- `Akdeniz`
- `İç Anadolu`
- `Karadeniz`
- `Doğu Anadolu`
- `Güneydoğu Anadolu`

Olası ilerideki sistemler:

- `nuts-1`
- `nuts-2`
- `custom`

Bu sistemler tek bir örtük `region` namespace'inde karıştırılmamalıdır. `region_kind` aracılığıyla açık tutun.

## Geometri Politikası

- bölge geometrisi, il geometrilerinin ortak sınırlar boyunca eritilmesiyle üretilmelidir
- uygulama, iç il kenarlarının bölge çıktısına taşınmaması için topoloji tabanlı birleştirmeyi tercih etmelidir
- bölge, kasıtlı olarak benimsenip doğrulanmadıkça ikinci bir yetkili ham geometri kaynağı sunmamalıdır
- ilçe geometrisi değişmeden kalır

## Dışa Aktarım Kuralları

Önerilen ilk geçerli kombinasyonlar:

- `scope=turkey` + `detail=region`
- `scope=turkey` + `detail=province`
- `scope=region` + `detail=province`
- `scope=province` + `detail=district`

Ertelenen kombinasyon:

- `scope=region` + `detail=district`

Neden:

- yük boyutunu ve arayüz karmaşıklığını artırır
- ilk kullanışlı bölge sürümü için gerekli değildir

## Kimlik Stratejisi

Önerilen format:

- `TR-R-XXX`

Örnekler:

- `TR-R-MAR`
- `TR-R-EGE`

İleride birden fazla bölge sistemi desteklenirse:

- kimliğe tür bilgisini göm, ya da
- kimlikler `region_kind` namespace'i içinde sabit kalır ve aramalarda `region_kind` gerektirilir

## Geriye Dönük Uyumluluk

Kırılmayı en aza indirmek için:

- ilçe `parent_id`'sini değiştirme
- bölge desteğini eklemeli bir katman olarak ekle
- mevcut il ve ilçe dışa aktarım yollarını kaldırma
