# Veri Lisansı ve Kaynak Politikası

Bu repo içindeki kod ve veri aynı lisans altında değerlendirilmez.

## Kod

- Repo kaynak kodu lisansı: `MIT`

## Yayınlanabilir veri

Bu repo içinde yayınlanması hedeflenen açık veri kaynakları:

- `source/yayinlanabilir/`

Buradaki her kaynak için mümkün olduğunda şu bilgiler tutulur:

- kaynak adı
- kaynak URL'si
- erişim veya indirme tarihi
- yerel manifest yolu
- lisans veya kullanım notu

Temel kural:

- Bir veri kaynağı açık veri portalı, açık lisans veya açık yeniden dağıtım şartıyla teyit edilmeden yayınlanabilir veri sayılmaz.

## Yayın kaynağı sayılmayan alanlar

Bu klasörler çalışma, karşılaştırma veya referans amaçlıdır:

- `source/kamu-kaynak/`
- `source/mulki-idare/`
- `source/hdx/`
- açık lisansı net olmayan kent rehberi / ArcGIS / benzeri servisler

Bu alanlardaki veriler:

- keşif
- kalite kontrol
- isim eşleme
- referans sayım kontrolü
- iç değerlendirme

için tutulabilir; ancak otomatik olarak GitHub üzerinden yayınlanabilir veri sayılmaz.

## Açık veri karar mantığı

Bir kaynağın yayına alınması için aranan eşik:

1. Açık lisans veya açık yeniden dağıtım izni görünür olmalı.
2. Kaynak kurum veya veri sağlayıcı belli olmalı.
3. Gerekliyse atıf metni üretilebilmeli.
4. Kullanım şartı projeyle çelişmemeli.

Şu tip kaynaklar tek başına yeterli sayılmaz:

- sadece görüntülenebilen kent rehberi uygulamaları
- public görünen ama lisansı yazmayan ArcGIS servisleri
- lisansı belirsiz GitHub depoları
- izin veya token gerektiren kurumsal servisler
- açık olmayan TUCBS / TKGM / benzeri platform erişimleri

## Kullanım sorumluluğu

Bu repoda yayımlanan veriler:

- resmi işlem
- kadastro
- hukuki delil
- mühendislik uygulaması
- ticari karar desteği

amacıyla doğrudan güvence verilerek sunulmaz.

Verilerin doğruluğu, güncelliği, tamlığı ve belirli bir amaca uygunluğu garanti edilmez. Kullanıcı, kullanacağı veri kaynağının güncel lisans ve kullanım şartlarını ayrıca kontrol etmelidir.

## Atıf

Yayınlanabilir veri kaynakları için atıf yaklaşımı:

- mümkünse ilgili manifest dosyasındaki kaynak kullanılır
- mümkünse kaynak URL'si ve kurum adı korunur
- belediye veya kurum özel lisansı varsa ona uyulur

Özet ilke:

- Kod `MIT`
- Veri kendi kaynağının lisansına tabidir
- Açık lisansı belirsiz veri repoda yayın kaynağı yapılmaz
