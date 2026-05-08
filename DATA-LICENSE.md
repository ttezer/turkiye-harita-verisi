# Veri Lisansı ve Kaynak Politikası

Bu repo içindeki kod ve veri aynı lisans altında değerlendirilmez.

## Kod

- Repo kaynak kodu lisansı: `MIT`

## Aktif veri kaynakları

Bu repoda aktif veri modeli yalnızca şu kaynaklara dayanır:

- `source/hdx/`
  - il ve ilçe verisi
- `source/yayinlanabilir/`
  - açık veriyle yayınlanabilir mahalle verisi
- kullanıcı tarafından sonradan eklenecek manuel mahalle verileri

## HDX lisans ve referans notu

İl ve ilçe katmanlarında kullanılan aktif kaynak, HDX üzerindeki `COD-AB-TUR` veri setinin repo içine alınmış snapshot'ıdır.

- Kaynak: [https://data.humdata.org/dataset/cod-ab-tur](https://data.humdata.org/dataset/cod-ab-tur)
- Sağlayıcı yapılar: OCHA / HDX dağıtımı üzerinden sunulan idarî sınır veri paketi
- Repo içindeki kullanım biçimi: canlı servis çağrısı değil, pinlenmiş dosya snapshot'ı
- Beklenen lisans ailesi: `CC BY-IGO`
- Atıf ve veri kaynağı sorumluluğu veri sağlayıcısına aittir; repo kod lisansı ile karıştırılmaz

Snapshot ve dosya düzeni için:

- [source/hdx/README.md](/D:/turkiye_map/source/hdx/README.md)

## Pasif referans alanları

Bu alanlar aktif build kaynağı değildir:

- `archive/kamu-kaynak/`
- `source/mulki-idare/`
- `source/reference/` içindeki kalite ve eşleme tablolarının referans tarafları

Bu alanlar:

- karşılaştırma
- kalite kontrol
- isim eşleme
- manuel çizim desteği
- iç referans

için tutulabilir; ancak otomatik olarak yayın kaynağı sayılmaz.

## Yayın kararı

Bir mahalle verisinin yayın hattına girmesi için:

1. Açık veri veya açık yeniden dağıtım koşulu net olmalı.
2. Kaynak kurum veya veri sağlayıcı belli olmalı.
3. Gerekirse atıf bilgisi üretilebilmeli.
4. Kullanım koşulları projeyle çelişmemeli.

Bu eşiği karşılamayan veriler repo içinde referans olarak tutulabilir ama yayınlanabilir veri sayılmaz.

## Kullanım sorumluluğu

Bu repoda yayınlanan veriler:

- resmî işlem
- kadastro
- hukukî delil
- mühendislik uygulaması
- ticarî karar desteği

için garanti verilerek sunulmaz.

Verilerin doğruluğu, güncelliği ve tamlığı garanti edilmez. Kullanıcı, kullanacağı verinin güncel lisans ve kullanım koşullarını ayrıca kontrol etmelidir.

## Özet

- Kod `MIT`
- İl ve ilçe için aktif kaynak `HDX`
- Mahalle için aktif kaynaklar açık veri ve manuel veri
- `archive/kamu-kaynak/` pasif referans arşividir
- Veri kendi kaynağının lisansına tabidir
