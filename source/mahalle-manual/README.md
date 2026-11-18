# Mahalle Manual

Bu klasör, mahalle geometri pipeline'ında açıkça tanımlanmış manuel kaynak dosyalarını tutar.

Kurallar:

- yalnızca `scripts/normalize-mahalle-geometrileri.js` içinde tanımlı dosyalar build'e alınır
- her il tek bir `raw/<il>-mahalle.kml` dosyasıyla temsil edilir
- ilçe düzeltmeleri ayrı klasör veya dosya olarak bırakılmaz; il KML'ine işlenir
- ham dosya adı il ve veri türünü yansıtır

Beklenen kullanım:

- `source/mahalle-manual/<plaka>-<il>/raw/<il>-mahalle.kml`

Bu klasör açık veri kaynağı yerine geçmez; lisans, kaynak ve kalite notları ayrıca korunmalıdır.

Ayrıntılı klasör standardı için [docs/source-layout.md](../../docs/source-layout.md) belgesine bakın.
