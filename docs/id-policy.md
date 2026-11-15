# Kimlik Politikası

## Bölge Kimliği

Format: `TR-R-XXX`

- `TR`: ülke kodu
- `R`: bölge (region)
- `XXX`: bölge kısaltması

Örnek: `TR-R-MAR`

## İl Kimliği

Format: `TR-P-XX`

- `TR`: ülke kodu
- `P`: il (province)
- `XX`: iki haneli plaka kodu

Örnek: `TR-P-34`

İl kimliği plaka kodundan türetilir; görünen ad veya crosswalk kimliği il
kimliğinin yerine geçmez.

## İlçe Kimliği

Format: `TR-D-XX-YYY`

- `TR`: ülke kodu
- `D`: ilçe (district)
- `XX`: bağlı olduğu ilin plaka kodu
- `YYY`: HDX snapshot'ındaki ilçe yerel kodu

Örnek: `TR-D-34-001`

## Kaynak ve kararlılık

İlçe kimliği ad alfabetik sıralamasıyla yeniden numaralandırılmaz. `YYY`, HDX
`pcode` değerinden alınır; böylece aynı kaynak kodu korunduğu sürece ilçe
kimliği de korunur.

İsim, `tuik_id`, `icisleri_id` ve diğer crosswalk alanları eşleme/metadata
amacıyla kullanılır; canonical kimlik üretmez.

Bölge üyelikleri ve bölge kimlikleri ayrıca
`source/reference/regions.geographic-7.json` referansında sabittir.
