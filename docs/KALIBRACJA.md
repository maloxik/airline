# Kalibracja modelu popytu

Wygenerowane 2026-11-24 poleceniem `npm run calibrate`. Nie edytować ręcznie.

Model liczy, ilu ludzi chce lecieć między dwoma lotniskami, z prawdziwych danych o ludności,
zamożności, turystyce i powiązaniach między krajami. Tutaj porównujemy go z prawdziwym ruchem
pasażerów z Eurostatu za 2023 rok.

## Wynik

- Tras w porównaniu: **4790** (ruch co najmniej 20 tys. pasażerów rocznie).
- Zgodność rzędu wielkości (korelacja logarytmów): **0.48**.
- Model mieści się w przedziale od połowy do dwukrotności prawdziwego ruchu na **50%** tras,
  a w przedziale od jednej trzeciej do trzykrotności na **71%**.
- Mediana stosunku model / rzeczywistość: **0.61**.
- Z 5000 losowych par dobrze opisanych lotnisk, między którymi nikt regularnie nie lata, model widzi
  ponad 40 pasażerów dziennie na **51%**.

Liczby w tabelach to pasażerowie dziennie w jedną stronę, średnio w roku.

## Jak to czytać

Prawdziwy ruch to nie to samo co popyt. Pokazuje tylko trasy, które ktoś lata, i jest ograniczony
liczbą miejsc w samolotach. Na lotniskach przesiadkowych zawiera też pasażerów, którzy lecą dalej.
Model ma więc trafiać w rząd wielkości i w kolejność tras, a nie w dokładne liczby.

## Trasy z Polski

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Dortmund (DTM) – Katowice (KTW) | 533 | 178 | 0.33× |
| Katowice (KTW) – Luton, Luton (LTN) | 336 | 202 | 0.60× |
| Balice (KRK) – London, Essex (STN) | 467 | 183 | 0.39× |
| Luton, Luton (LTN) – Warsaw (WAW) | 567 | 219 | 0.39× |
| London (LHR) – Warsaw (WAW) | 759 | 256 | 0.34× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – Warsaw (WAW) | 703 | 284 | 0.40× |
| Frankfurt am Main (FRA) – Warsaw (WAW) | 679 | 239 | 0.35× |
| Gdańsk (GDN) – Warsaw (WAW) | 380 | 195 | 0.51× |
| Balice (KRK) – Warsaw (WAW) | 457 | 215 | 0.47× |
| Warsaw (WAW) – Wrocław (WRO) | 385 | 261 | 0.68× |
| Gdańsk (GDN) – Oslo (Gardermoen) (OSL) | 295 | 75 | 0.25× |
| Amsterdam (AMS) – Warsaw (WAW) | 761 | 343 | 0.45× |
| Orio al Serio (BG) (BGY) – Balice (KRK) | 265 | 111 | 0.42× |
| Dublin (DUB) – Balice (KRK) | 262 | 169 | 0.64× |
| Eindhoven (EIN) – Katowice (KTW) | 165 | 189 | 1.15× |

## Znane trasy w Europie

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Barcelona (BCN) – Madrid (MAD) | 2646 | 1775 | 0.67× |
| Dublin (DUB) – London (LHR) | 2320 | 1483 | 0.64× |
| Amsterdam (AMS) – London (LHR) | 1898 | 1493 | 0.79× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – London (LHR) | 1442 | 1920 | 1.33× |
| Berlin (BER) – Frankfurt am Main (FRA) | 1617 | 912 | 0.56× |
| Berlin (BER) – Munich (MUC) | 1234 | 808 | 0.65× |
| Paris (Orly, Val-de-Marne) (ORY) – Toulouse/Blagnac (TLS) | 1971 | 440 | 0.22× |
| Stockholm (ARN) – Copenhagen (CPH) | 1632 | 79 | 0.05× |
| London (LGW) – Palma de Mallorca (PMI) | 930 | 337 | 0.36× |
| Düsseldorf (DUS) – Palma de Mallorca (PMI) | 1801 | 277 | 0.15× |
| Málaga (AGP) – Manchester, Greater Manchester (MAN) | 808 | 149 | 0.18× |
| Spata-Artemida (ATH) – Thessaloniki (SKG) | 2039 | 182 | 0.09× |
| Lisbon (LIS) – Porto (OPO) | 1075 | 164 | 0.15× |

## Gdzie model najbardziej zawyża

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Amsterdam (AMS) – London, Essex (STN) | 240 | 1299 | 5.41× |
| Dublin (DUB) – Nottingham, Leicestershire (EMA) | 226 | 1199 | 5.29× |
| London (LGW) – Paris (Orly, Val-de-Marne) (ORY) | 352 | 1804 | 5.13× |
| Düsseldorf (DUS) – Hamburg (HAM) | 171 | 813 | 4.76× |
| Paris (Orly, Val-de-Marne) (ORY) – Pendik, Istanbul (SAW) | 163 | 713 | 4.38× |
| Spata-Artemida (ATH) – Pendik, Istanbul (SAW) | 228 | 876 | 3.83× |
| London (LCY) – Rotterdam (RTM) | 187 | 699 | 3.74× |
| Amsterdam (AMS) – Leeds, West Yorkshire (LBA) | 214 | 752 | 3.51× |
| Mahón (Maó) (MAH) – Paris (Orly, Val-de-Marne) (ORY) | 153 | 525 | 3.43× |
| Paris (Roissy-en-France, Val-d'Oise) (CDG) – Luton, Luton (LTN) | 446 | 1506 | 3.38× |

## Gdzie model najbardziej zaniża

| Trasa | Naprawdę | Model | Model / naprawdę |
|---|---|---|---|
| Ponta Delgada (PDL) – Praia da Vitória (TER) | 342 | 0 | 0.00× |
| Akureyri (AEY) – Reykjavík (RKV) | 229 | 1 | 0.00× |
| Ferno (VA) (MXP) – Sharm El Sheikh (SSH) | 374 | 1 | 0.00× |
| Sta Cruz de la Palma, La Palma Island (SPC) – Tenerife (TFN) | 945 | 3 | 0.00× |
| Copenhagen (CPH) – Vágar (FAE) | 383 | 1 | 0.00× |
| Düsseldorf (DUS) – Hurghada (HRG) | 641 | 3 | 0.00× |
| Hurghada (HRG) – Katowice (KTW) | 355 | 2 | 0.00× |
| Hurghada (HRG) – Schkeuditz (LEJ) | 311 | 1 | 0.00× |
| Hannover (HAJ) – Hurghada (HRG) | 272 | 1 | 0.01× |
| Hurghada (HRG) – Zurich (ZRH) | 352 | 2 | 0.01× |

## Dopasowane parametry

```json
{
  "kBusiness": 9857,
  "kTourism": 3.517,
  "kVfr": 1518,
  "betaBusiness": 1,
  "betaTourism": 1,
  "betaVfr": 0.6216,
  "wealthPower": 0.5,
  "domesticBoost": 4.812
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
