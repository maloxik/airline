# Kalibracja modelu popytu

Wygenerowane 2026-11-24 poleceniem `npm run calibrate`. Nie edytować ręcznie.

Model liczy, ilu ludzi chce lecieć między dwoma lotniskami, z prawdziwych danych o ludności,
zamożności, turystyce i powiązaniach między krajami. Tutaj porównujemy go z prawdziwym ruchem
pasażerów z Eurostatu za 2023 rok.

## Wynik

- Tras w porównaniu: **5374** (ruch co najmniej 20 tys. pasażerów rocznie).
- Zgodność rzędu wielkości (korelacja logarytmów): **0.43**.
- Model mieści się w przedziale od połowy do dwukrotności prawdziwego ruchu na **48%** tras,
  a w przedziale od jednej trzeciej do trzykrotności na **68%**.
- Mediana stosunku model / rzeczywistość: **0.60**.
- Z 5000 losowych par dobrze opisanych lotnisk, między którymi nikt regularnie nie lata, model widzi
  ponad 40 pasażerów dziennie na **53%**.

Liczby w tabelach to pasażerowie dziennie w jedną stronę, średnio w roku.

## Jak to czytać

Prawdziwy ruch to nie to samo co popyt. Pokazuje tylko trasy, które ktoś lata, i jest ograniczony
liczbą miejsc w samolotach. Na lotniskach przesiadkowych zawiera też pasażerów, którzy lecą dalej.
Model ma więc trafiać w rząd wielkości i w kolejność tras, a nie w dokładne liczby.

## Trasy z Polski

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Dortmund (DTM) – Katowice (KTW) | 533 | 189 | 0.35× |
| Katowice (KTW) – Luton, Luton (LTN) | 336 | 215 | 0.64× |
| Balice (KRK) – London, Essex (STN) | 467 | 198 | 0.42× |
| Luton, Luton (LTN) – Warsaw (WAW) | 567 | 239 | 0.42× |
| London (LHR) – Warsaw (WAW) | 759 | 279 | 0.37× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – Warsaw (WAW) | 703 | 344 | 0.49× |
| Frankfurt am Main (FRA) – Warsaw (WAW) | 679 | 266 | 0.39× |
| Gdańsk (GDN) – Warsaw (WAW) | 380 | 194 | 0.51× |
| Balice (KRK) – Warsaw (WAW) | 457 | 214 | 0.47× |
| Warsaw (WAW) – Wrocław (WRO) | 385 | 259 | 0.67× |
| Gdańsk (GDN) – Oslo (Gardermoen) (OSL) | 295 | 76 | 0.26× |
| Amsterdam (AMS) – Warsaw (WAW) | 761 | 394 | 0.52× |
| Orio al Serio (BG) (BGY) – Balice (KRK) | 265 | 132 | 0.50× |
| Dublin (DUB) – Balice (KRK) | 262 | 176 | 0.67× |
| Eindhoven (EIN) – Katowice (KTW) | 165 | 203 | 1.23× |

## Znane trasy w Europie

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Barcelona (BCN) – Madrid (MAD) | 2646 | 1802 | 0.68× |
| Dublin (DUB) – London (LHR) | 2320 | 1479 | 0.64× |
| Amsterdam (AMS) – London (LHR) | 1898 | 1815 | 0.96× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – London (LHR) | 1442 | 2342 | 1.62× |
| Berlin (BER) – Frankfurt am Main (FRA) | 1617 | 911 | 0.56× |
| Berlin (BER) – Munich (MUC) | 1234 | 815 | 0.66× |
| Paris (Orly, Val-de-Marne) (ORY) – Toulouse/Blagnac (TLS) | 1971 | 448 | 0.23× |
| Stockholm (ARN) – Copenhagen (CPH) | 1632 | 88 | 0.05× |
| London (LGW) – Palma de Mallorca (PMI) | 930 | 375 | 0.40× |
| Düsseldorf (DUS) – Palma de Mallorca (PMI) | 1801 | 309 | 0.17× |
| Málaga (AGP) – Manchester, Greater Manchester (MAN) | 808 | 161 | 0.20× |
| Spata-Artemida (ATH) – Thessaloniki (SKG) | 2039 | 185 | 0.09× |
| Lisbon (LIS) – Porto (OPO) | 1075 | 163 | 0.15× |

## Gdzie model najbardziej zawyża

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Amsterdam (AMS) – London, Essex (STN) | 240 | 1581 | 6.59× |
| London (LGW) – Paris (Orly, Val-de-Marne) (ORY) | 352 | 2194 | 6.24× |
| Paris (Orly, Val-de-Marne) (ORY) – Pendik, Istanbul (SAW) | 163 | 864 | 5.31× |
| Dublin (DUB) – Nottingham, Leicestershire (EMA) | 226 | 1194 | 5.27× |
| Düsseldorf (DUS) – Hamburg (HAM) | 171 | 809 | 4.74× |
| London (LCY) – Rotterdam (RTM) | 187 | 840 | 4.49× |
| Spata-Artemida (ATH) – Pendik, Istanbul (SAW) | 228 | 1003 | 4.39× |
| Amsterdam (AMS) – Leeds, West Yorkshire (LBA) | 214 | 911 | 4.26× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – Luton, Luton (LTN) | 446 | 1837 | 4.12× |
| Mahón (Maó) (MAH) – Paris (Orly, Val-de-Marne) (ORY) | 153 | 586 | 3.82× |

## Gdzie model najbardziej zaniża

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Ponta Delgada (PDL) – Praia da Vitória (TER) | 342 | 0 | 0.00× |
| Katowice (KTW) – Marsa Alam (RMF) | 264 | 0 | 0.00× |
| Marsa Alam (RMF) – Warsaw (WAW) | 207 | 0 | 0.00× |
| Fort-de-France (FDF) – Pointe-à-Pitre (PTP) | 453 | 1 | 0.00× |
| Akureyri (AEY) – Reykjavík (RKV) | 229 | 0 | 0.00× |
| Ferno (VA) (MXP) – Marsa Alam (RMF) | 219 | 1 | 0.00× |
| Sta Cruz de la Palma, La Palma Island (SPC) – Tenerife (TFN) | 945 | 2 | 0.00× |
| Ferno (VA) (MXP) – Sharm El Sheikh (SSH) | 374 | 1 | 0.00× |
| Copenhagen (CPH) – Vágar (FAE) | 383 | 1 | 0.00× |
| Düsseldorf (DUS) – Hurghada (HRG) | 641 | 3 | 0.00× |

## Dopasowane parametry

```json
{
  "kBusiness": 12020,
  "kTourism": 5.14,
  "kVfr": 827.6,
  "betaBusiness": 1,
  "betaTourism": 1,
  "betaVfr": 0.5476,
  "wealthPower": 0.5,
  "domesticBoost": 3.91
}
```

## Znane słabości

- **Konkurencja lądowa** zależy na razie tylko od odległości i od tego, czy po drodze jest morze.
  Nie wie o prawdziwych liniach kolejowych ani o wyspach wewnątrz krajów. To następny krok.
- **Lotniska przesiadkowe** (Londyn Heathrow, Frankfurt, Amsterdam, Paryż) mają w rzeczywistości
  dużo pasażerów w tranzycie, których model nie liczy.
- **Wielka Brytania, Turcja i kraje spoza Eurostatu** mają noclegi szacowane z ludności,
  a powiązania z Wielką Brytanią są wpisane w przybliżeniu.
- **Ludność** pochodzi z miejscowości powyżej tysiąca mieszkańców, więc wsie nie są liczone.
