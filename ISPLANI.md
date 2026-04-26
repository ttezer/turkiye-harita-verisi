# İş Planı

Bu dosya repo temizliği, kaynak klasörü sadeleştirme ve dokümantasyon güncelleme işlerini takip etmek içindir. README dosyaları ve kaynak label notları artık kısmen güncellendi; aşağıdaki maddeler kalan düzenleme alanlarını takip eder.

## Path/Key Kontrolü

2026-04-22 temizlik sonrası kontrol:

- `source/hdx/cod-ab-tur/extracted/` generated kabul edildi. Klasör silindi ve `.gitignore` kapsamına alındı. `scripts/lib/pipeline.js` içindeki `hdxExtractedDir` kalmalı; HDX fallback gerektiğinde zip'ten yeniden extract ediyor.
- `source/kamu-kaynak/yerlesim/*report*.json`, hole-repair preview dosyaları ve overlap/coverage ara raporları generated kabul edildi. Scriptler bu dosyaları üretiyor, ama commit'e girmemeleri gerekiyor.
- `source/mahalle` kaldırıldı. Legacy source catalog ve override dosyaları `source/reference` altına taşındı.
- Legacy ham mahalle kaynakları gerekiyorsa beklenen yeni yer `source/legacy-mahalle/<il>/...`; default build bunu kullanmaz, yalnızca `INCLUDE_LEGACY_MAHALLE_SOURCES=1` ile legacy karşılaştırma denenebilir.
- Key/gizli bilgi taramasında `.env` tipi kalıcı secret bulunmadı. Kodda görünen `service_url`, ArcGIS/MapServer adresleri ve Ankara için runtime'da üretilen `Authorization` token'ı legacy kaynak okuyucu akışına ait. Bunlar gizli API key gibi ele alınmıyor, ama default kamu-kaynak akışında kullanılmamalı.
- `source/reference/nvi-surface-report.json` içinde `__RequestVerificationToken` varlığına dair rapor metni bulunuyor; gerçek token değeri saklanmıyor.

## README Güncelleme Zonları

- Kök `readme.md`: Mahalle/Türkiye geneli kamu-kaynak geçişi, legacy mahalle kaynaklarının `source/reference/legacy-mahalle-*.json` altında tutulduğu, OSM altlık sadece önizleme olduğu ve büyük mahalle önizlemesinin limitli render edildiği kısa anlatılmalı. Mevcut ana sayfa görseli bozulmamalı.
- Kök `readme.md`: GitHub Pages zorunluluğu nedeniyle büyük dosya stratejisi açık yazılmalı. Projenin ayrı sunucu/CDN kullanmadan GitHub Pages üzerinde çalıştığı, bu yüzden `dist` ve generated veri çıktılarında boyut optimizasyonu yapıldığı belirtilmeli.
- Kök `readme.md`: Kullanıcılara "tüm formatlar destekleniyor" derken bazı büyük çıktıların Pages içinde statik dosya olarak tutulmayabileceği, seçilen filtreye göre tarayıcıda üretilebileceği veya release/artifact yaklaşımına taşınabileceği net anlatılmalı.
- `DATA-LICENSE.md`: Kamu-kaynak ana kaynak, Mülki İdare metadata/kalite referansı, HDX fallback/legacy rolü ve ticari kullanım/doğruluk sorumluluğu netleştirilmeli.
- `source/README.md`: Aktif kaynak klasörleri ile legacy/generated klasörler ayrılmalı.
- `source/mahalle/README.md`: Tamamlandı; klasör kaldırıldı, legacy dosyalar `source/reference` altına taşındı.
- `source/hdx/README.md`: Extracted dosyaların generated olduğu ve commit'e girmeyeceği net kalmalı.
- `scripts/README.md`: Report/preview scriptlerinin çıktılarının generated/ignored olduğu ve hangi scriptlerin default build'e dahil olduğu güncellenmeli.
- `docs/pipeline-design.md` ve karar dokümanları: HDX ana kaynak anlatımı kamu-kaynak ana kaynak kararına göre revize edilmeli.
- `source/kamu-kaynak/yerlesim/WORKLOG.md`: `coverage-report.json` ve `quality-report.json` artık generated/ignored ise bu not güncellenmeli.

## AI_REVIEW_HANDOFF'tan Taşınan İşler

Bu bölüm `AI_REVIEW_HANDOFF.md` içinde dağınık duran operasyonel yapılacakların çalışma planına taşınmış halidir. Devir dosyası bağlam için kalabilir; aktif iş takibi burada yapılmalı.

### Kritik Kontroller

- İlk açılışta bölge haritası gerçekten 7 bölge gibi mi görünüyor, yoksa il parçaları algısı devam ediyor mu kontrol edilecek.
- Bölge seviyesinde stroke kapalıyken hover/selected görünümü yeterince anlaşılır mı bakılacak.
- Eski sorunlu mahalle illeri tekrar manuel test edilecek: Ankara, Denizli, Gaziantep, Kocaeli, Muğla, Sakarya.
- Mahalle hover ve sağ bilgi kartı her ilçede `Ad`, `İl`, `İlçe` alanlarını doğru gösteriyor mu kontrol edilecek.
- Mahalle filtresi farklı bölge/il seçiliyken otomatik yanlış il seçiyor mu tekrar test edilecek.
- KML/KMZ Google Earth içinde tekrar test edilecek; özellikle seçili alanlarda `il adı`, `ilçe adı`, `mahalle adı` seçilince boş dosya oluşmamalı.
- GeoJSON, JSON, TopoJSON, SHP, CSV, XLSX, SQL, WKT, KML, KMZ formatları seçili alanlarla spot-check edilecek.
- CSV'de `x/y` alanlarının centroid olduğu netleştirilecek; polygon vertex listesi beklentisi varsa ayrı format/kolon tasarlanacak.
- `dist/geojson/mahalle-geometrileri-by-district/*.geojson` dosyalarının repo/release/artifact stratejisi netleştirilecek.
- `source/kamu-kaynak` raw snapshotlarının hangileri repoda tutulacak, hangileri generated/harici kabul edilecek karar verilecek.

### Bekleyen Ürün İşleri

- UI kalite notu tamamlanacak: harita kartında kalite yüzdesi/skoru, tıklanınca hata/eksik/uyarı listesi.
- `scripts/report-kamu-kaynak-quality.js` çıktısı UI'a bağlanacak.
- Mahalle kalite raporu kullanıcıya indirilebilir veya okunabilir formatta sunulacak.
- Seydikemer tipi uzak çok parçalı polygon uyarıları tüm Türkiye için otomatik kalite kontrolüne dönüştürülecek.
- `source_only` geometri ile resmi mahalle/köy polygonları arasındaki yüksek overlap kontrolü tüm Türkiye'ye uygulanacak.
- Mülki İdare ile kamu-kaynak sayıları arasındaki farklar için politika yazılacak: kamu-kaynak ana geometri, Mülki İdare metadata/kalite referansı.
- `source_hdx_id` adlandırması için karar verilecek: kısa vadede legacy compatibility olarak kalabilir, uzun vadede `legacy_source_id` veya `canonical_source_code` gibi genel alan düşünülebilir.
- `CHANGELOG.md` son mahalle/kamu-kaynak/export değişikliklerini yansıtıyor mu kontrol edilecek.

### Klasör Temizliği

- Hedef yapı netleştirildi: `source/kamu-kaynak`, `source/mulki-idare`, `source/hdx`, `source/reference`; opsiyonel legacy ham veri yeri `source/legacy-mahalle`.
- `source/mahalle` aktif veri kaynağı olmaktan çıkarıldı; `sources.json`, `name-overrides.json`, `quality-notes.json` `source/reference` altına taşındı.
- `source/mahalle/quality-notes.json` taşındı: yeni hedef `source/reference/quality-overrides.json`.
- `source/hdx/cod-ab-tur/extracted/` generated kalacak; zip ve manifest fallback/legacy için korunacak.
- HDX tamamen taşınacaksa önce `normalize:hdx`, `source_hdx_id`, crosswalk ve test bağımlılıkları incelenecek.
- `source/mulki-idare/yerlesimler/Mahalle_Listesi.xls`, `Koy_Listesi.xls`, `Bagli_Listesi.xls` metadata üretimi için korunacak.
- `source/reference/e-icisleri-provinces.snapshot.json` silinmiş görünüyor; yeni konumun `source/mulki-idare/e-icisleri-provinces.snapshot.json` olduğu doğrulanacak.
- `source/kamu-kaynak/yerlesim/WORKLOG.md` release öncesi kalacak mı, `docs/internal/` altına mı taşınacak karar verilecek.
- Her il klasöründeki `report.json` dosyalarının kalıp kalmayacağı kararlaştırılacak.
- `data/normalized`, `data/processed` ve rapor JSON dosyaları için generated/repo politikası netleştirilecek.
- `.claude/oneriler.md`, `.claude/readme2.md` gibi proje dışı notlar varsa commit dışı bırakılacak veya silinecek.

### Kalite Kontrol Sistemi

- Kalite uyarıları kesin hata gibi değil, otomatik kontrol uyarısı olarak gösterilecek.
- İlk kontroller: geometri yok, boş/geçersiz polygon, isim yok, il/ilçe metadata bağlantısı yok, duplicate mahalle adı, Mülki İdare ile eşleşmeyen `source_only` kayıt, kamu-kaynakta olup Mülki İdare'de olmayan kayıt, Mülki İdare'de olup kamu-kaynak geometrisinde olmayan kayıt.
- Geometri kontrolleri: çok parçalı polygon, birbirinden uzak çok parçalı polygon, aşırı büyük bbox, centroid'in bağlı ilçe dışına düşmesi, yüksek oranlı üst üste binen polygon.
- Uyarı metni örneği: `Kamu-kaynak verisinde birbirinden uzak çok parçalı polygon tespit edildi.`
- Kullanıcı metni örneği: `Kaynak veride bazı mahalle sınırları birbirinden uzak parçalar halinde geliyor. Bu durum kaynak veriden kaynaklanabilir; harita dikkatli kullanılmalıdır.`
- Gümüşhane Merkez/Tekke tipi problem için `source_only_overlap` veya `overlapping_settlement_geometry` uyarısı eklenecek.
- Önerilen eşik: `source_only` alanının yüzde 50+ kısmı resmi mahalle/köylerle çakışıyorsa `warning`, yüzde 80+ ise `high`.
- Otomatik kalite kontrolü veriyi değiştirmeyecek; önce raporlayacak.
- Manuel istisnalar için `source/reference/quality-overrides.json` tasarlanacak.
- 2026-04-22 Muğla manuel kararları standart `issue/status` notlarına çevrildi; referans kayıtlar `source/reference/quality-overrides.json` içinde tutuluyor.
- Önerilen çıktılar: `data/processed/quality-report.json`, `dist/json/quality-report.json`, `dist/json/quality-by-province/*.json`, `dist/json/quality-by-district/*.json`.

### CSV ve Export

- CSV'de `x`, `y`, `coordinate_system`, `centroid_lat`, `centroid_lon`, `geometry_wkt` alanları tekrar kontrol edilecek.
- UI'da koordinat sistemi seçimi isteniyor mu netleştirilecek; şu an gerçek projeksiyon dönüşümü yok.
- Ondalık ayırıcı seçimi UI'da yok; JS number çıktısı doğal olarak nokta kullanıyor.
- Aynı dosyayı ikinci kez indirme problemi tekrar test edilecek.
- Seçili alanlarla KML/KMZ boş inme problemi regresyon testine bağlanacak.

### Test Listesi

- Minimum kontrol: `npm test`.
- Minimum smoke: `npm run test:smoke`.
- Tam veri pipeline kontrolü: `npm run build`, ardından `npm test` ve `npm run test:smoke`.
- Mahalle geometri isim kontrolü: `dist/geojson/mahalle-geometrileri.geojson` içinde feature sayısı ve isimsiz feature sayısı kontrol edilecek.
- Beklenen yaklaşık mahalle geometri sonucu: `50624` feature ve `0` isimsiz kayıt.

### Commit Öncesi Kontrol

- `git status --short` çıktısı reviewedilecek; generated dosyalar yanlışlıkla girmemeli.
- `source/kamu-kaynak` büyük yeni kaynak klasörü olarak ayrıca değerlendirilecek.
- `source/mulki-idare` yeni ayrılmış klasör olarak path/test açısından kontrol edilecek.
- `source/yerlesimler/README.md` silindiyse yeni karşılığı `source/mulki-idare/yerlesimler` altında mı doğrulanacak.
- `source/mahalle` kaldırıldı; legacy ham dosya gerekirse `source/legacy-mahalle` kullanılacak.
- Yeni scriptler reviewedilecek: `fetch-kamu-kaynak-admin.js`, `fetch-kamu-kaynak-yerlesim.js`, `report-kamu-kaynak-*`.
- Büyük `dist` çıktıları repoya girecekse bunun bilinçli karar olduğu notlanacak.

## Gönderim Karar Taslağı

2026-04-22 envanter:

- Repo kökü boyutları: `dist` yaklaşık 1.9 GB, `data` yaklaşık 1.2 GB, `source` yaklaşık 585 MB.
- `source` içinde ağırlık: `source/kamu-kaynak` yaklaşık 551 MB, `source/hdx` yaklaşık 22 MB, `source/mulki-idare` yaklaşık 12 MB.
- Git durumu özeti: 1201 modified, 998 untracked, 7 deleted.
- Değişikliklerin çoğu `dist` altında: yaklaşık 2139 dosya. Bunun ana kısmı `dist/geojson` ve `dist/json`.
- `data/processed` altında 9 rapor/metadata dosyası değişmiş.
- `source` altında kamu-kaynak, mülki-idare, hdx, mahalle ve reference tarafında değişiklikler var.

Önerilen karar:

- Commit'e girmeli: kaynak kodu, pipeline scriptleri, testler, schema, `package.json`, `package-lock.json`, `.gitignore`, `ISPLANI.md`.
- Commit'e girmeli: `source/kamu-kaynak`, `source/mulki-idare`, gerekli `source/reference` dosyaları ve HDX zip/manifest gibi fallback kaynakları.
- Commit'e girmemeli/generated kalmalı: `source/hdx/cod-ab-tur/extracted/`, kamu-kaynak ara raporları, hole-repair preview dosyaları, coverage/quality/overlap geçici raporları.
- Karar bekliyor: `dist` klasörü. Canlı site doğrudan buradan servis ediliyorsa commit'e girmesi gerekebilir; aksi halde release artifact/CDN daha doğru.
- Karar bekliyor: `data/processed`. Build ile tekrar üretilebiliyorsa commit dışı/generated olmalı; proje yayın paketi bunu kullanıyorsa kalabilir.
- Tamamlandı: `source/mahalle` kaldırıldı; legacy katalog/override dosyaları `source/reference` altına taşındı.
- README ve lisans dokümanları güncellenecek ama ana sayfa görseli bozulmadan ve veri sorumluluk reddi net yazılarak yapılmalı.
- README içinde GitHub Pages kısıtı özellikle yazılmalı: şu an başka web sunucusu/CDN kullanılmadığı için repo/site boyutu kritik, büyük tekrar dosyaları azaltmak tercih değil zorunluluk.

2026-04-22 uygulanan hızlı Pages küçültme:

- `app.js` ilk yüklemede `dist/geojson/mahalle-geometrileri.geojson` dosyasını indirmeyecek şekilde değiştirildi.
- Mahalle geometrisi lazy-load oldu: ilçe/il/bölge/Türkiye seçiminde `dist/geojson/mahalle-geometrileri-by-district/*.geojson` dosyaları ihtiyaç oldukça yüklenir ve cache'lenir.
- `dist/geojson/mahalle-geometrileri.geojson` commit dışı/generated kabul edildi.
- `dist/geojson/mahalle-geometrileri-by-province/` commit dışı/generated kabul edildi.
- `dist/json/yerlesimler-by-district/` ve `dist/json/yerlesimler-by-province/` kullanılmayan tekrar çıktılar olarak commit dışı/generated kabul edildi.
- `csv`, `kml`, `kmz`, `shp`, `sql`, `wkt` Pages'te kalacak kararına dokunulmadı.
- Hızlı sonuç: `dist` yaklaşık 1.9 GB seviyesinden yaklaşık 1.09 GB seviyesine indi. Hâlâ GitHub Pages için sınırda; kalıcı çözüm için Pages yayın hedefini sadece web assets + gerekli `dist` çıktıları olacak şekilde ayırmak değerlendirilmeli.

2026-04-22 ikinci küçültme:

- Statik CSV ve SQL çıktılarından `geometry_wkt` çıkarıldı. WKT formatı ayrı olarak Pages'te kaldığı için bu tekrar gereksizdi.
- `scripts/export.js` artık CSV/SQL için `withoutGeometryWkt(...)` kullanıyor.
- `scripts/normalize-mahalle-geometrileri.js` artık tek dev `dist/geojson/mahalle-geometrileri.geojson` ve il bazlı `dist/geojson/mahalle-geometrileri-by-province/` üretmiyor.
- `scripts/export.js` artık kullanılmayan `dist/json/yerlesimler-by-province/` ve `dist/json/yerlesimler-by-district/` üretmiyor.
- Temiz `npm run build` ve `npm run test:smoke` geçti.
- Yeni `dist` boyutu yaklaşık `890 MB`.
- Not: `dist` artık Pages yayın sınırının altında görünüyor; ancak Pages repo kökünden yayınlanırsa `source`, `data`, dokümanlar ve diğer klasörler de siteye dahil olur. Kalıcı doğru yöntem GitHub Pages'i Actions artifact ile sadece gerekli web dosyaları ve `dist` üzerinden yayınlamaktır.

Commit öncesi dikkat:

- `.gitignore` yeni generated dosyaları engeller, ancak geçmişte track edilmiş `data/processed`, `dist/json/yerlesimler-by-*`, `dist/geojson/mahalle-geometrileri.geojson` ve `dist/geojson/mahalle-geometrileri-by-province` dosyaları için commit öncesi bilinçli deletion veya `git rm --cached` kararı gerekir.
- `dist/geojson/mahalle-geometrileri-by-district` artık web için gerekli ve Pages'te kalmalı.
- `dist/json/regions.json`, `dist/json/provinces.json`, `dist/json/districts.json`, `dist/json/yerlesimler.json` web için gerekli ve Pages'te kalmalı.
- Son hızlı kontrol: `node --check app.js`, `node --check scripts/export.js`, `node --check scripts/normalize-mahalle-geometrileri.js`, `npm run build`, `npm run test:smoke`, `npm test -- tests/download-format.test.js tests/ui-download-integration.test.js` geçti.

## Kalacak / Silinecek Basit Tablo

Bu tablo commit öncesi kafa karışıklığını azaltmak için son karar özetidir.

| Kalacak | Silinecek / Commit Dışı Kalacak |
| --- | --- |
| `app.js`, `index.html`, `styles.css`, `download.js` | `data/normalized/` |
| `scripts/*.js` pipeline ve export değişiklikleri | `data/processed/` |
| `package.json`, `package-lock.json` | `dist/geojson/mahalle-geometrileri.geojson` |
| `.gitignore` | `dist/geojson/mahalle-geometrileri-by-province/` |
| `ISPLANI.md` | `dist/json/yerlesimler-by-district/` |
| `AI_REVIEW_HANDOFF.md` devir notu | `dist/json/yerlesimler-by-province/` |
| `source/kamu-kaynak/` ana kaynak | `source/hdx/cod-ab-tur/extracted/` |
| `source/mulki-idare/` metadata/kalite referansı | Kamu-kaynak ara raporları: `coverage-report*.json`, `quality-report.json`, `overlap-report.json`, `final-overlap-*` |
| `source/hdx/cod-ab-tur/tur_admin_boundaries.geojson.zip` ve `manifest.json` fallback/legacy için | Hole-repair preview dosyaları |
| `source/reference/` gerekli crosswalk/override dosyaları | Eski ham belediye mahalle dosyaları: KML/KMZ/SHP/DBF/RAR vb. |
| `dist/json/regions.json` | |
| `dist/json/provinces.json` | |
| `dist/json/districts.json` | |
| `dist/json/yerlesimler.json` | |
| `dist/geojson/regions.geojson` | |
| `dist/geojson/provinces.geojson` | |
| `dist/geojson/districts.geojson` | |
| `dist/geojson/mahalle-geometrileri-by-district/` | |
| `dist/csv/` | |
| `dist/kml/` | |
| `dist/kmz/` | |
| `dist/shp/` | |
| `dist/sql/` | |
| `dist/wkt/` | |
| `dist/topojson/` | |
| `dist/xlsx/` | |

Net karar:

- Web için gereken çıktı `dist` altında kalacak, ama tekrar eden büyük mahalle kopyaları kalmayacak.
- Build ara çıktıları `data/processed` ve `data/normalized` commit dışı kalacak.
- GitHub Pages için kısa vadede hedef: `dist` yaklaşık 1 GB altında kalsın.
- Uzun vadede hedef: Pages yayını repo kökünden değil, sadece gerekli web dosyaları + `dist` içeren artifact/branch üzerinden yapılsın.

## Skorlama Referansı

Kullanıcı "skorlama" dediğinde bu tablo güncel durum için başlangıç referansı kabul edilecek. Skorlar 10 üzerinden verilir.

| Başlık | Skor | Not |
| --- | ---: | --- |
| Güvenlik | 7 | Kalıcı secret/API key görünmüyor. Eksik: dependency audit ve Pages yayın kapsamı netliği. |
| Stres | 6 | Büyük dosya yükü azaltıldı ama Türkiye geneli mahalle build'i hâlâ heap/boyut açısından ağır. |
| Kod Kalitesi | 7 | Pipeline ve lazy-load iyileşti. Eksik: bazı legacy mode path'leri ve `source_hdx_id` semantiği hâlâ sadeleşmeli. |
| Test | 7 | Build, smoke ve hedefli export testleri geçti. Eksik: lazy-load mahalle UI/integration testi. |
| UI | 7 | Harita, altlık, yükleme durumu ve mahalle filtresi iyileşti. Eksik: kalite skoru paneli tamamlanmadı. |
| Performans | 7 | Tek dev mahalle dosyası ilk yüklemeden çıktı. Eksik: geniş mahalle görünümünde çok sayıda ilçe dosyası yüklenebilir. |
| Kullanılabilirlik | 7 | Formatlar ve filtreli indirme korunuyor. Eksik: veri boyutu/kalite notu kullanıcıya net anlatılmalı. |
| Dökümantasyon | 5 | İş planı iyi ama README, DATA-LICENSE, CHANGELOG ve docs son kararları tam yansıtmıyor. |
| Veri Bütünlüğü | 7 | Kamu-kaynak ana geometri hattı oldu. Eksik: kalite/overlap raporu UI'a bağlı değil. |
| Hata Yönetimi | 6 | Fetch hata durumu var. Eksik: lazy-load parça dosya hatalarında kullanıcı mesajı ve retry. |
| Denetlenebilirlik | 7 | İş planı ve kaynak ayrımı iyi. Eksik: generated/committed ayrımı staging aşamasında tamamlanmalı. |
| Yedekleme ve Kurtarma | 5 | Kaynak snapshotları var, build tekrar üretilebilir. Eksik: release artifact, Pages artifact, rollback/yedek stratejisi. |

Genel skor: yaklaşık `6.6/10`.

En hızlı puan artıracak işler:

- README, DATA-LICENSE ve CHANGELOG güncelle.
- Git status/staging temizliği yap.
- Lazy-load mahalle için test ekle.
- Pages deploy stratejisini artifact/branch olarak netleştir.
- Kalite skorunu UI'a bağla.
