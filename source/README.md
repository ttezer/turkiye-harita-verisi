# Source

Bu klasor aktif il, ilce ve mahalle kaynaklarini tutar.

## Alt klasorler

- `source/hdx/`
  Il ve ilce icin aktif snapshot kaynagi.
- `source/yayinlanabilir/`
  Acik veri mahalle kaynaklari ve bunlara ait manifestler.
- `source/mahalle-manual/`
  Aktif hatta açıkça tanımlanmış manuel mahalle dosyaları.
- `source/mulki-idare/`
  Referans listeler ve dogrulama yardimcilari.
- `source/reference/`
  Crosswalk, override ve kalite tablolarini tutar.

## Kural

- Aktif build yalnizca tanimli aktif kaynaklara dayanir.
- `source/mulki-idare/` doğrulama/referans içindir; varsayılan mahalle geometri akışına girmez.
- Pasif referans veya arsiv verisi burada aktif kaynak gibi belgelenmemelidir.

## Kalite ve kapsam notlari

- Elle yazilan kalite notlari `source/reference/quality-overrides.json` icinde tutulur.
- Otomatik sinyaller `data/processed/mahalle-geometrileri-report.json` icinden okunur.
- Kismi il veya tek ilce kapsayan kaynaklar `limited_source_coverage` ile isaretlenir.

Ilgili belgeler:

- [docs/data-sources.md](../docs/data-sources.md)
- [docs/source-layout.md](../docs/source-layout.md)
- [docs/pipeline.md](../docs/pipeline.md)
