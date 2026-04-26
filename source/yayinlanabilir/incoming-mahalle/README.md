# Incoming Mahalle

Bu klasör, kullanıcı tarafından sonradan verilecek ham mahalle dosyaları için bekleme alanıdır.

Buraya bırakılabilecek örnek dosyalar:

- `geojson`
- `kml`
- `kmz`
- `shp` paketi
- `zip`
- `xlsx`
- `csv`

Kurallar:

- Dosya geldi diye otomatik yayınlanabilir kaynak sayılmaz.
- Önce kaynak kurum, lisans ve kapsam kontrol edilir.
- Uygun bulunursa ilgili il için ayrı manifest hazırlanır ve kalıcı klasöre taşınır.
- Uygun bulunmazsa burada çalışma / değerlendirme dosyası olarak kalır veya başka iç kaynağa alınır.
