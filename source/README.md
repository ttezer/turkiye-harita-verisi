# source/

Bu klasör ham kaynaklar, referans tabloları ve yayınlanabilir açık veri manifestlerini tutar.

## Alt klasörler

- `source/yayinlanabilir/`
  Yayınlanabilir açık veri kaynakları ve bunlara ait manifestler.

- `source/kamu-kaynak/`
  Çalışma, karşılaştırma veya doğrulama için kullanılan iç veri alanı. Otomatik olarak yayın kaynağı sayılmaz.

- `source/mulki-idare/`
  E-İçişleri ve benzeri idari referans listeleri. Sayı ve isim kontrolü için kullanılır.

- `source/hdx/`
  Fallback, karşılaştırma ve legacy uyumluluk amaçlı snapshotlar.

- `source/reference/`
  Crosswalk, override, kaynak etiketi ve kalite tabloları.

## Kural

- Ham kaynak dosyaları yerinde elle düzenlenmez.
- Dönüşüm ve üretim işleri `scripts/` altında yapılır.
- Repo üzerinden yayımlanacak veri yalnızca `source/yayinlanabilir/` politikasına göre belirlenir.
