# İş Planı

Bu dosya aktif veri modeline göre kalan teknik işleri takip eder.

## Hedef model

- İl ve ilçe için tek aktif kaynak `HDX`
- Mahalle için aktif kaynaklar:
  - `source/yayinlanabilir/` altındaki açık veri
  - sonradan eklenecek manuel mahalle verileri
- `archive/kamu-kaynak/` pasif manuel referans arşivi

## Tamamlananlar

- `archive/kamu-kaynak/` aktif `source/` akışından çıkarıldı.
- Default il ve ilçe normalize akışı `HDX` odaklı hale getirildi.
- Mahalle normalize akışında arşiv kamu verisi default davranıştan çıkarıldı.
- Mahalle aktif referans dosyaları `source/reference/` altına toplandı.
- Mahalle kaynak adlandırmaları aktif modele göre sadeleştirildi.
- `app.js` içinde başarısız mahalle geometry fetch cache kilidi düzeltildi.
- `scripts/normalize-mahalle-geometrileri.js` içinde eksik manuel mahalle klasörü crash'i düzeltildi.
- Kimlik alanları aktif modele göre sadeleştirildi.

## Devam edenler

- Root dokümanlarda aktif model dışı anlatımı temizlemek
- `CHANGELOG.md` ve kalan referans notlarını yeni modele çekmek
- `hdx_id` semantiğini sabitlemek ve export/test tarafında tutarlılığı doğrulamak

## Doğrulama listesi

- `npm test`
- `npm run test:smoke`
- hedefli alan kontrolleri:
  - `tests/normalize.test.js`
  - `tests/assign-ids.test.js`
  - `tests/validate.test.js`

## Sonraki teknik işler

- Mahalle manuel veri klasörü adını ve beklenen yapıyı netleştirmek
- Açık veri manifestleri ile export kapsamlarını yeniden gözden geçirmek
- Pasif referans arşivinden aktif akışla ilgili kalan bağlantıları temizlemek
