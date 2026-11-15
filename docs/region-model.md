# Bölge Modeli

`region` seviyesi mevcut modelde uygulanmıştır. Hiyerarşi:

```text
region -> province -> district
```

İlçe için kanonik ebeveyn hâlâ ildir. Bölge, illeri gruplandıran üst katmandır;
ilçenin doğrudan ebeveyni değildir.

## Uygulanan model

### Bölge

- `level = region`
- `parent_id = null`
- `region_kind = geographic-7`
- `member_ids`, bölgeye bağlı il kimliklerini içerir
- kimlik biçimi `TR-R-XXX`'tir

Bölge üyeliği [`source/reference/regions.geographic-7.json`](../source/reference/regions.geographic-7.json)
dosyasında açıkça tutulur. Pipeline bu referanstan metadata ve il geometrilerinin
dissolve edilmiş bölge geometrisini üretir.

### İl

- `level = province`
- `parent_id = region.id`
- `region_id = region.id`
- il, ilçenin kanonik ebeveyni olmaya devam eder

### İlçe

- `level = district`
- `parent_id = province.id`
- `region_id`, bağlı ilin bölgesini gösterir

## İlk ve mevcut bölge sistemi

Mevcut sistem, Birinci Coğrafya Kongresi ile ilişkilendirilen yedi coğrafi bölgeyi
referans üyelik tablosu olarak kullanır:

- Marmara
- Ege
- Akdeniz
- İç Anadolu
- Karadeniz
- Doğu Anadolu
- Güneydoğu Anadolu

Bu, idari bir ilçe kademesi veya ayrı bir resmî polygon kaynağı değildir. Bölge
geometrileri il geometrilerinin topoloji tabanlı birleştirilmesiyle üretilir; iç
il sınırları bölge geometrisinde korunmaz.

İleride `nuts-1`, `nuts-2` veya özel gruplamalar eklenirse her biri ayrı
`region_kind` olarak tanımlanmalıdır. Farklı sistemler örtük tek bir namespace'te
karıştırılmamalıdır.

## Dışa aktarım

Bölge çıktıları diğer katmanlarla aynı export hattından üretilir. Geçerli temel
kombinasyonlar:

- `scope=turkey` + `detail=region`
- `scope=turkey` + `detail=province`
- `scope=region` + `detail=province`
- `scope=province` + `detail=district`

`scope=region` + `detail=district` için uygulama desteği ayrıca doğrulanmadan
belge veya entegrasyon sözleşmesine eklenmemelidir.
