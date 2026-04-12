# XLSX Bağımlılık Notu

Mevcut paket:

- `xlsx@0.18.5`

12 Nisan 2026 tarihli mevcut `npm audit` durumu:

- yüksek önem seviyesinde advisory: SheetJS içinde Prototype Pollution
- yüksek önem seviyesinde advisory: SheetJS Regular Expression Denial of Service
- `npm audit` şu anda `fixAvailable: false` raporluyor

Anlamı:

- mevcut registry ve audit durumuna göre doğrudan bir npm upgrade yolu görünmüyor
- upstream fix veya alternatif bir yol seçilene kadar bu bağımlılık bilinen ve kabul edilmiş risk olarak ele alınmalı

Repodaki mevcut kullanım:

- `scripts/export.js` içinde build sırasında workbook export
- `test-ui` içinde browser taraflı workbook üretimi

Risk yönetimi önerisi:

1. Workbook üretimini güvenilen yerel ve proje verisiyle sınırlı tut.
2. Bu repoda `xlsx` kullanarak kullanıcıdan gelen keyfi spreadsheet dosyalarını parse etme.
3. Release öncesi `npm audit` tekrar kontrol et.
4. Repo ileride güvenilmeyen spreadsheet parse edecekse `xlsx` yerine alternatif değerlendirmesi yap veya o akışı izole et.
