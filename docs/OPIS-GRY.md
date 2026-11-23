# Opis gry do mockupów (brief dla AI)

Ten plik jest samowystarczalny: wklej go w całości do dowolnego narzędzia AI i poproś o mockup.
Na końcu są gotowe polecenia. Styl graficzny jest celowo otwarty, żeby każde narzędzie
zaproponowało własny.

---

## 1. Gra w jednym zdaniu

Symulator linii lotniczej na telefon, w którym planszą jest prawdziwa mapa świata, a popyt na
loty wynika z prawdziwej geografii: z tego, ilu ludzi mieszka w pobliżu lotniska i czy między
miastami nie jeździ szybki pociąg.

## 2. Podstawowe fakty

- **Platforma:** telefon, układ pionowy (projektuj dla 390 × 844 px), obsługa jedną ręką, kciukiem.
- **Tryb:** jeden gracz, działa offline. Bez liczników czasu, bez sklepu z walutą premium, bez reklam.
- **Język interfejsu:** polski (polskie znaki: ą ć ę ł ń ó ś ź ż).
- **Odbiorca:** dorosły, który lubi lotnictwo, mapy i gry ekonomiczne. Chce czuć się jak szef
  linii, a nie jak księgowy.
- **Nazwa robocza:** Airline. Przykładowa linia gracza: „Silesia Air” (zmyślona).

## 3. Co gracz robi (pętla gry)

1. Wybiera lotnisko startowe, najlepiej swoje lokalne. Dostaje jeden mały samolot (70 miejsc)
   i trochę pieniędzy.
2. Dotyka na mapie innego lotniska. Gra od razu pokazuje, ilu ludzi dziennie chce tam lecieć
   i ile trasa by zarobiła.
3. Otwiera trasę, ustawia cenę biletu i liczbę rotacji dziennie.
4. Patrzy, jak samoloty latają po mapie. Czas płynie ciągle, można go zatrzymać lub przyspieszyć.
5. Co tydzień dostaje wynik. Dobre trasy zarabiają, złe tracą. Za zysk kupuje kolejne samoloty.
6. Rośnie: linia regionalna → krajowa → kontynentalna → globalna. Po drodze pojawiają się
   rywale, sezonowość, większe samoloty i lotniska przesiadkowe.

## 4. Co wyróżnia tę grę (to musi być widać na mockupie)

- **Zlewnia lotniska.** Wokół lotniska widać obszar, z którego ludzie dojadą w 90 minut,
  z liczbą mieszkańców (np. Katowice: 4,6 mln). Im większa zlewnia, tym większy popyt.
- **Kolej i drogi zabierają pasażerów.** Na krótkich trasach z dobrym pociągiem samolot
  przegrywa. Na trasie Katowice–Warszawa gra pokazuje linię kolejową i podział: 80% jedzie
  lądem, 20% leci. Gracz ma to zrozumieć jednym spojrzeniem na mapę.
- **Mapa jest główną treścią, nie tłem.** Zajmuje większość ekranu i zawsze jest widoczna.
  Decyzje podejmuje się, dotykając mapy, a nie przeklikując tabele.
- **Natychmiastowa odpowiedź.** Zmiana ceny biletu od razu zmienia wypełnienie i wynik.

## 5. Ekrany

### 5.1 Mapa (ekran główny, najważniejszy)

Zawsze widoczne:
- nazwa i znak linii gracza, stan konta, wynik tygodnia (zysk lub strata),
- data i godzina w grze, sterowanie czasem: pauza, normalnie, szybko,
- dolna nawigacja: Mapa, Trasy, Flota, Finanse.

Na mapie:
- lotniska jako punkty z kodem trzyliterowym (KTW, WAW, LTN); większe miasto = większy punkt,
- baza gracza wyraźnie wyróżniona, wokół niej zlewnia 90 minut,
- trasy gracza jako łuki; trasa ze stratą wyraźnie inna niż zyskowna,
- trasy rywala w innym, spokojniejszym stylu,
- małe samoloty lecące po łukach,
- linia kolejowa pokazywana przy trasie, na której kolej konkuruje z samolotem.

Dolna karta (ok. 35–40% wysokości ekranu) zmienia się zależnie od tego, co dotknięto.

### 5.2 Karta trasy (po dotknięciu własnej trasy)

- skąd–dokąd i odległość,
- wypełnienie samolotów w procentach,
- liczba pasażerów dziennie,
- wynik tygodnia w złotych,
- podział podróżnych: ląd kontra samolot (tylko gdy ląd konkuruje),
- suwak ceny biletu,
- wybór liczby rotacji dziennie (1–6),
- krótki werdykt słowny, np. „Ląd wygrywa”, „Brakuje 117 miejsc”, „Sezon: lipiec ×4”.

### 5.3 Karta lotniska (po dotknięciu lotniska bez trasy)

- nazwa miasta i kod, odległość od bazy, podgląd łuku na mapie,
- zlewnia w milionach mieszkańców,
- popyt dzienny z bazy gracza,
- szacowany wynik tygodnia,
- jeden wyraźny przycisk: „Otwórz trasę”.

### 5.4 Karta bazy (po dotknięciu własnego lotniska)

- lista wszystkich tras z bazy: kod, kierunek, liczba rotacji, wynik tygodnia,
- dotknięcie wiersza przenosi do karty trasy.

### 5.5 Pozostałe ekrany (drugi plan)

- **Trasy:** wszystkie trasy posortowane po wyniku, z szybkim podglądem wypełnienia.
- **Flota:** samoloty gracza (typ, liczba miejsc, zasięg, wiek, przypisana trasa), rynek:
  kup nowy, kup używany, leasing.
- **Finanse:** przychody i koszty tygodnia (paliwo, załogi, opłaty lotniskowe, obsługa, leasing),
  wykres stanu konta, kredyt.
- **Start gry:** wybór lotniska bazowego na mapie świata, nazwa i barwy linii.
- **Raport tygodnia:** krótkie podsumowanie: najlepsza trasa, najgorsza trasa, co zrobił rywal.

## 6. Przykładowy stan gry (użyj tych danych w mockupie)

Linia: Silesia Air · baza: Katowice (KTW) · konto: 4 820 000 zł · wynik tygodnia: +98 000 zł ·
data: wtorek 16.02.2027, 08:00 · flota: 4 samoloty po 70 miejsc.

| Trasa | Odległość | Rotacje | Wypełnienie | Wynik tygodnia | Uwaga |
|---|---|---|---|---|---|
| KTW → WAW Warszawa | 229 km | 3 | 45% | −77 000 zł | kolej 2 h 20 zabiera 80% podróżnych |
| KTW → DTM Dortmund | 830 km | 2 | 100% | +105 000 zł | stabilna trasa pracownicza |
| KTW → LTN Londyn Luton | 1400 km | 1 | 100% | +46 000 zł | brakuje miejsc, warto dodać rotację |
| KTW → BGY Bergamo | 880 km | 1 | 100% | +52 000 zł | |
| KTW → SPU Split | 800 km | 1 | 33% | −29 000 zł | sezonowa, w lipcu popyt ×4 |

Lotnisko bez trasy do pokazania w karcie lotniska: AMS Amsterdam, 1012 km, zlewnia 8 mln,
popyt 187 osób dziennie, szacowany wynik +50 000 zł tygodniowo.

Rywal (sterowany przez grę) lata z Warszawy do Paryża, Frankfurtu i Sztokholmu.

Obszar mapy na mockupie: Europa od Londynu po Stambuł, Polska blisko środka.

## 7. Ton

Poważna, ale lekka. Świat lotnictwa cywilnego: tablice odlotów, karty pokładowe, mapy
lotnicze, oznakowanie lotnisk, rozkłady lotów, barwy linii. Bez wojska, bez katastrof,
bez postaci z kreskówek.

## 8. Czego unikać

- typowego „panelu z aplikacji finansowej”: ciemne tło, zaokrąglone kafelki ze wskaźnikami,
  pastylki, szklane rozmycia, gradienty, neonowe akcenty,
- emoji i przypadkowych ikon zamiast treści,
- chowania mapy pod oknami i tabelami,
- prawdziwych nazw i logo linii lotniczych oraz producentów samolotów,
- małego tekstu: liczby mają być czytelne na telefonie trzymanym w ręce.

## 9. Kierunki stylu do wypróbowania (opcjonalnie, wybierz jeden albo zaproponuj własny)

1. **Papierowa mapa lotnicza.** Jasny, ciepły papier, czarny tusz, jeden kolor sygnałowy,
   pismo maszynowe do liczb, klapkowa tablica odlotów, stemple.
2. **Złota era lotnictwa.** Plakat linii lotniczej z lat 60.: płaskie plamy koloru,
   geometryczne pismo, mapa tras jak z pokładowego magazynu.
3. **Centrum operacyjne.** Ekran kontroli ruchu: precyzyjna siatka, cienkie linie, znaczniki
   lotów z etykietami, wysoki kontrast, zero ozdobników.
4. **Miniatura.** Mapa jak makieta lub gra planszowa: lekka głębia, drewniane pionki
   samolotów, żetony lotnisk.

---

## Gotowe polecenia

### Dla AI, które tworzy klikalny interfejs (kod HTML lub aplikację)

> Na podstawie powyższego opisu zaprojektuj i zbuduj klikalny mockup ekranu głównego (5.1)
> z kartami 5.2, 5.3 i 5.4, w układzie pionowym 390 × 844. Użyj danych z punktu 6.
> Mapa ma zajmować większość ekranu. Zaproponuj własny, wyrazisty styl graficzny zgodny
> z punktem 7 i omijający punkt 8. Najpierw opisz w trzech zdaniach wybrany kierunek,
> potem zbuduj mockup. Interfejs po polsku.

### Dla AI, które generuje obrazy (po angielsku, bo tak działają lepiej)

> Mobile game UI mockup, portrait 9:19.5, airline management simulator played on a real map
> of Europe. The map fills most of the screen: airports as dots with three-letter codes
> (KTW, WAW, LTN, DTM, BGY, SPU, AMS), curved flight routes fanning out from Katowice in
> southern Poland, tiny aircraft flying along them, a circle around the home airport showing
> its 90-minute catchment area, one short route to Warsaw running next to a railway line.
> Top strip: airline name "SILESIA AIR", balance "4 820 000 zł", date and time-speed controls.
> Bottom panel covering about a third of the screen: route card "KATOWICE – WARSZAWA, 229 km",
> load factor 45%, 189 passengers per day, weekly result −77 000 zł, a bar splitting
> travellers 80% rail / 20% air, a ticket price slider, a rotations-per-day selector.
> Bottom navigation with four tabs: MAPA, TRASY, FLOTA, FINANSE.
> Style: [wstaw jeden kierunek z punktu 9, np. "printed aeronautical chart on warm paper,
> black ink, one signal colour, split-flap departure board lettering, rubber stamps"].
> Civil aviation mood. No dark fintech dashboard, no glassmorphism, no neon, no gradients,
> no emoji, no real airline logos. Crisp, legible, flat.
