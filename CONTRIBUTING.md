# Katkı Rehberi

Bu repo, vendored kaynak veri ve kürasyonlu referans tablolar üzerinden tekrarlanabilir Türkiye idari sınır artifact’ları üretir.

## Temel Kurallar

- canonical kimlikler deterministik kalmalı
- görünen adlar key olarak kullanılmamalı
- geometri ve metadata ayrı tutulmalı
- kaynak soy ağacı veya lisans notları sessizce değiştirilmemeli
- schema evrimi, kırıcı alan değişimlerinden çok eklemeli ilerlemeli

## Ortam

Mevcut build için gerekenler:

- `Node.js` `24.x`
- `npm run build` içinde kullanılan referans veri yardımcı script’leri için `Python`

Bağımlılık kurulumu:

```bash
npm install
```

## Varsayılan Akış

1. `source/` altındaki kaynak veya referans girdileri güncelle ya da vendor et
2. `npm run build` çalıştır
3. `npm run example:js` çalıştır
4. `npm run test:smoke` çalıştır
5. üretilen artifact’ları `data/processed/` ve `dist/` altında kontrol et

Yerel görsel inceleme için:

1. `npm run test:ui`
2. `http://127.0.0.1:4173` adresini aç

## Veri Kuralları

- HDX türevi dosyalar yalnızca repo `MIT` lisansı altında değerlendirilmez; atıf ve kaynak notlarını koru
- bölge üyelikleri kürasyonlu referans veridir ve açık şekilde dokümante edilmelidir
- `tuik_id`, `icisleri_id`, `osm_relation_id` ve `lau_code` gibi dış crosswalk alanları, tekrarlanabilir bire bir kaynak doğrulanmadıkça nullable kalmalıdır

## Kod Kuralları

- `data/processed/*` veya `dist/*` yazan canonical pipeline adımlarında öncelik `Node.js`
- Python script’leri şu anda araştırma ve referans yardımcı üretimiyle sınırlı
- script hataları açık olmalı; pipeline adımları hızlı düşmeli ve aksiyon alınabilir mesaj üretmeli
- yeni çıktı eklenirse schema, doküman, smoke coverage ve package export birlikte güncellenmeli

## Pull Request Kontrol Listesi

- build geçiyor
- smoke test geçiyor
- davranış veya çıktılar değiştiyse doküman güncellendi
- lisans ve kaynak notları hâlâ doğru
- üretilen çıktılar deterministik
