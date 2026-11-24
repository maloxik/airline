# Roadmapa

Wersja 2, 2026-11-23. Zastępuje wersję 1 (sześć plastrów pod telefon). Projekt gry:
[PROJEKT-GRY.md](PROJEKT-GRY.md).

## Zasady

- Każda faza kończy się czymś, co da się uruchomić w przeglądarce pod linkiem i ocenić.
- Najpierw sprawdzamy to, co może wywrócić projekt: czy prawdziwe dane dają wiarygodny popyt
  i czy podstawowa pętla bawi. Dopiero potem dokładamy systemy.
- Rdzeń symulacji jest osobnym modułem bez interfejsu, z testami. Interfejs można wymienić,
  symulacji nie.
- Rozmiar faz podaję względnie (S, M, L, XL), bez dat: tempo zależy od tego, ile sesji
  tygodniowo idzie na ten projekt obok MAKROnetu, ONDiesel i Urzędu.

## Mapa drogowa w skrócie

| Faza | Nazwa | Rozmiar | Wynik |
|---|---|---|---|
| 0 | Decyzje i fundament | S | repozytorium, stos, pusta aplikacja pod linkiem |
| 1 | Prawdziwy świat | L | paczka danych Europy i mapa popytu, którą da się oglądać |
| 2 | Rdzeń ekonomii | M | symulacja bez interfejsu, zbalansowana w testach |
| 3 | Pierwsza grywalna wersja | L | jedna baza, trasy, ceny, tydzień po tygodniu |
| 4 | Flota i siatka | L | rynek samolotów, nowe lotniska, bazy, oferty samorządów |
| 5 | Marka i ludzie | M | marketing na mapie, reputacja, załogi |
| 6 | Rywale i żywy świat | L | linie sterowane przez grę, zdarzenia, karty decyzji |
| 7 | Przesiadki i późna gra | M | węzły, program lojalnościowy, przejęcia |
| 8 | Kariera, scenariusze, samouczek | M | pełna rozgrywka od startu do późnej gry |
| 9 | Szlif i wydanie | L | demo w przeglądarce, Steam, potem telefon |
| 10 | Po premierze | — | reszta świata, wyzwanie tygodnia, cargo |

Bramki, na których projekt może się zatrzymać: po fazie 1 (czy dane mają sens) i po fazie 3
(czy gra bawi).

---

## Faza 0: Decyzje i fundament (S)

**Stan 2026-11-24: zrobione lokalnie, bez zdalnego repozytorium i wdrożenia.**
Jest projekt TypeScript (Vite, React, MapLibre), rdzeń `src/sim` z testami, aplikacja z mapą
Europy, dniem i nocą, światłami miast i 685 prawdziwymi lotniskami z OurAirports (pierwszy
kawałek fazy 1). Zostało: założyć repozytorium na GitHubie i projekt na Vercelu.

- Zatwierdzić otwarte decyzje z projektu gry (platformy, stos, zasięg mapy, czas gry).
- Repozytorium ze zdalnym adresem, projekt TypeScript, wdrożenie na Vercel po każdym commicie.
- Podział na moduły: `sim` (symulacja, bez interfejsu), `data` (budowanie paczki danych),
  `app` (mapa i interfejs).
- Pusta aplikacja: mapa Europy z własnym stylem, działająca na komputerze i na telefonie.

**Gotowe, gdy:** pod linkiem otwiera się mapa, a testy i wdrożenie przechodzą automatycznie.

## Faza 1: Prawdziwy świat (L)

Najważniejsza faza. Tu rozstrzyga się, czy obietnica „prawdziwych danych” jest do spełnienia.

- Potok danych w `data/`: pobranie, oczyszczenie i złożenie w jedną paczkę:
  lotniska (OurAirports), ludność w siatce (GHSL), miasta (GeoNames), zamożność regionów
  (Eurostat, Bank Światowy), noclegi turystów miesięcznie (Eurostat), migranci między krajami
  (ONZ), kolej i autostrady (OpenStreetMap).
- Zlewnia każdego lotniska: ludność w zasięgu dojazdu, z podziałem między sąsiednie lotniska
  (Katowice i Kraków dzielą się ludźmi).
- Model popytu z trzema rodzajami podróżnych: służbowi, turyści, rodzina i praca.
- Konkurencja lądowa: szacowany czas dojazdu pociągiem lub samochodem między miastami.
- **Kalibracja na prawdziwym ruchu**: porównanie modelu z danymi Eurostatu o ruchu między
  lotniskami. Cel: dla większości dużych tras wynik w rozsądnym przedziale od rzeczywistości.
- Narzędzie do oglądania: mapa, na której po kliknięciu lotniska widać jego kartę i popyt
  do wszystkich innych, z rozbiciem na rodzaje podróżnych.

**Gotowe, gdy:** model sam „odkrywa” znane prawdy (Śląsk–Zagłębie Ruhry, Polska–Wielka Brytania,
wakacyjne szczyty nad Morzem Śródziemnym, martwy Radom) i mamy raport z kalibracji.

**Ryzyko:** dane z różnych źródeł nie pasują do siebie (inne lata, inne podziały regionów).
Jeśli kalibracja nie wyjdzie, upraszczamy model, zamiast udawać dokładność.

## Faza 2: Rdzeń ekonomii (M)

- Czas gry, flota, trasy, liczba lotów, wykorzystanie samolotu w ciągu doby.
- Przychód: popyt, cena, wypełnienie, dopłaty. Koszty: paliwo, załoga, opłaty, obsługa, raty.
- Rozkręcanie nowej trasy w czasie, sezonowość miesiąc po miesiącu.
- Rachunek tygodniowy, kredyt, bankructwo. Zapis i odczyt gry.
- Symulacje wieloletnie w testach jako narzędzie do balansu.

**Gotowe, gdy:** w testach rozsądny gracz rośnie, nierozsądny bankrutuje, a żadna pojedyncza
sztuczka nie daje pieniędzy bez końca.

## Faza 3: Pierwsza grywalna wersja (L)

- Wybór lotniska startowego z prawdziwą kartą okolicy.
- Otwieranie i zamykanie tras, cena, liczba lotów, podgląd skutków przed decyzją.
- Samoloty widoczne na mapie, upływ czasu z pauzą i przyspieszeniem.
- Podsumowanie tygodnia. Kupno kolejnego samolotu (na razie jeden typ, prosta oferta).
- Interfejs projektowany od zera na podstawie tego, co wybierzesz z mockupów (własnych
  i z innych AI). Do tej fazy żaden wygląd nie jest przesądzony.

**Gotowe, gdy:** obca osoba gra 20 minut bez tłumaczenia i chce grać dalej.
**Bramka:** jeśli pętla nie bawi, wracamy do projektu gry.

## Faza 4: Flota i siatka (L)

- Katalog samolotów w pięciu klasach, ze zmyślonymi nazwami i realistycznymi parametrami.
- Trzy drogi zakupu: nowy z kolejką dostaw i rabatem za ilość, używany, leasing.
- Starzenie, przeglądy, sprzedaż. Układ kabiny. Premia za jednolitą flotę.
- Otwarcie nowego lotniska jako inwestycja, opłaty, sloty na dużych lotniskach.
- Druga baza.
- **Oferty samorządów i lotnisk** (propozycja 1 z projektu): dopłaty i zniżki za gwarancję lotów.

**Gotowe, gdy:** da się zbudować linię na 20–30 samolotów różnymi drogami i każda z dróg
(tania, tradycyjna, regionalna) ma sens.

## Faza 5: Marka i ludzie (M)

- Znajomość marki jako warstwa mapy, rosnąca tam, gdzie linia lata.
- Kampanie kierowane w region, miasto albo trasę; sponsoring; promocja otwarcia.
- Reputacja z punktualności, odwołań, wieku floty i wygody.
- Piloci, personel pokładowy, mechanicy: zatrudnianie z opóźnieniem, płace, zadowolenie, strajk.
- Opinie pasażerów i postacie tłumaczące, kto lata daną trasą (propozycja 5).

**Gotowe, gdy:** ekspansja „od sąsiada do sąsiada” i „skok z dużą kampanią” są dwiema
różnymi, opłacalnymi strategiami.

## Faza 6: Rywale i żywy świat (L)

- Trzy typy linii sterowanych przez grę: narodowa, tani agresor, regionalna.
- Reakcje na ceny, wchodzenie na trasy gracza, wojny cenowe, bankructwa.
- Zdarzenia: paliwo, pogoda, strajki, awarie, wydarzenia w prawdziwych miastach.
- Kalendarz przyszłości: nowe linie kolejowe i rozbudowy lotnisk (propozycja 4).
- Karty decyzji prezesa (propozycja 7).

**Gotowe, gdy:** dwie rozgrywki z tego samego lotniska przebiegają wyraźnie inaczej.

## Faza 7: Przesiadki i późna gra (M)

- Pasażerowie przesiadkowi i lotnisko węzłowe.
- Program lojalnościowy, klasa biznes jako osobny produkt.
- Zabezpieczenie ceny paliwa, inwestor.
- Przejęcie rywala, wspólne loty.

**Gotowe, gdy:** po zbudowaniu węzła gra ma nowe, ciekawe decyzje, a nie tylko większe liczby.

## Faza 8: Kariera, scenariusze, samouczek (M)

- Etapy kariery od linii regionalnej do europejskiej, cele i odblokowania.
- Trzy do pięciu scenariuszy z celem.
- Samouczek wpleciony w pierwsze kwadranse gry.
- Porównanie z rzeczywistością po otwarciu trasy (propozycja 8).
- Wersja angielska (rynek gatunku jest głównie zagraniczny) i polska.

**Gotowe, gdy:** da się przejść od pierwszego samolotu do późnej gry bez dziur i zastojów.

## Faza 9: Szlif i wydanie (L)

- Dźwięk, animacje, dopracowanie mapy, wydajność na słabszych telefonach.
- Darmowe demo w przeglądarce (pierwszy etap kariery).
- Strona na Steamie wcześnie, żeby zbierać listy życzeń; wersja desktopowa; osiągnięcia.
- Telefon: opakowanie aplikacji, test zamknięty w Google Play.
- Ekran z atrybucją źródeł danych.

**Gotowe, gdy:** gra jest do kupienia na Steamie, a demo działa pod linkiem.

## Faza 10: Po premierze

- Reszta świata: Ameryka Północna, Azja, loty dalekiego zasięgu, prawa przewozowe.
- Wyzwanie tygodnia z jednym startem dla wszystkich.
- Cargo. Kampania historyczna. Sojusze.

---

## Największe ryzyka

| Ryzyko | Kiedy wyjdzie | Co robimy |
|---|---|---|
| Prawdziwe dane nie dają wiarygodnego popytu | faza 1 | kalibracja na danych Eurostatu, w razie czego prostszy model |
| Gra jest arkuszem z mapą, bez frajdy | faza 3 | twarda bramka i test na obcej osobie |
| Zakres jest za duży na jedną osobę z pomocą AI | cały czas | fazy 4–7 są od siebie niezależne i każdą można przyciąć albo przesunąć za premierę |
| Zatłoczony rynek | faza 9 | trzymać wyróżniki (prawdziwe dane, oferty samorządów, marka na mapie), nie gonić liderów na liczbę funkcji |
| Jedna aplikacja na komputer i telefon wymaga dwóch układów interfejsu | faza 3 | projektować oba od początku, mapa wspólna, panele osobne |
| Wydajność mapy na słabszych telefonach | faza 0 i 9 | sprawdzić już przy pustej aplikacji |
| Licencje danych | faza 1 | wszystkie źródła pozwalają na użytek komercyjny z podaniem źródła; potwierdzić przed wydaniem |
