# Commit Adlandırma Standardı

İlçe bazlı mahalle verisi entegrasyonlarında commit başlığı şu biçimde yazılır:

```text
<İl adı> İli İlçe Bazlı Mahalle Verisi
```

Örnek:

```text
Afyonkarahisar İli İlçe Bazlı Mahalle Verisi
```

Düzeltme veya yeniden üretim commit'lerinde konu açıkça belirtilir:

```text
<İl adı> İlçe Bazlı Mahalle Verisi Düzeltmeleri
<İl adı> İlçe Bazlı Mahalle Verisi Yeniden Üretimi
```

Commit tamamlanmadan önce kaynak dosyası, normalizer yapılandırması, yayın manifestosu, ilçe bazlı çıktı, coverage/report çıktıları ve QC sonuçları birlikte kontrol edilir. Sadece `source/` dosyasını ekleyip `dist/` yayın çıktısını eksik bırakmak geçerli değildir.
