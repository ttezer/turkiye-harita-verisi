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

## İlçe Kimliği

Format: `TR-D-XX-YYY`

- `TR`: ülke kodu
- `D`: ilçe (district)
- `XX`: bağlı olduğu ilin plaka kodu
- `YYY`: il içi deterministik sıra numarası

Örnek: `TR-D-34-001`

## Deterministik Sıralama

İlçe sıra numarası için uygulanan sıralama:

1. `name_ascii`
2. `tuik_id`
3. `icisleri_id`

Bu kural tüm üretimlerde sabit kalmalıdır.
