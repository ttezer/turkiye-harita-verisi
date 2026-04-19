# Yerlesimler Kaynak Dosyalari

Bu klasor, e-Icisleri Turkiye Mulki Idare Bolumleri Envanteri Excel ciktilarini ham kaynak olarak tutar.

- `Mahalle_Listesi.xls`: `yerlesim` katmani icin `type: "mahalle"` kayitlarinin kaynagi.
- `Koy_Listesi.xls`: `yerlesim` katmani icin `type: "koy"` kayitlarinin kaynagi.
- `Bagli_Listesi.xls`: simdilik islenmez; koy veya mahalle altindaki bagli birimler icin kaynak snapshot olarak saklanir.

Islenmis cikti `node scripts/normalize-yerlesimler.js` ile `data/processed/yerlesimler.metadata.json` dosyasina yazilir.
