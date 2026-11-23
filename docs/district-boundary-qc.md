# İlçe sınırı üretimi ve QC

İlçe geometrisi, mahalle geometri kapsamı bulunan ilçelerde atanmış mahalle poligonlarının birleşiminden üretilir. Mahalle geometri kapsamı bulunmayan ilçelerde mevcut idari ilçe geometrisi korunur.

Üretim öncesi QC; ilçe bazında mahalle sayısı/kapsamı, boş ve geçersiz geometri, çok parçalı mahallelerin her bir parçasının ilçe sınırı dışına taşması, başka ilçelerle kesişim, mahalle birleşimindeki boşluk ve ilçe sınırları arasındaki çakışmayı raporlar. Çok parçalı kayıt tek bir ilçe kimliği taşıdığı için parçalar ayrı ayrı denetlenir.

QC bulgusu olan ilçe beklemeye alınır; poligonlar otomatik kesilmez veya başka ilçeye atanmaz. QC raporunda il, ilçe, mahalle, parça sayısı, taşan/kesişen alan ve uygulanabilen oranlar yer alır. QC'den geçen ilçelerin birleşik geometrisi dışa aktarılır.

Mahalle verisi olmayan ilçeler için HDX ilçe geometrisi kullanılır.
