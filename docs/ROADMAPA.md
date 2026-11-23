# Roadmapa

Wersja 1, 2026-11-23. Plastry jak w Urzędzie: każdy kończy się czymś, co da się uruchomić
na telefonie i ocenić.

## Założenia

- **Wyróżnik:** mapa jako plansza. Popyt wynika z prawdziwej geografii (ludność w zasięgu
  lotniska, odległość, konkurencja kolei). Uzasadnienie: [KONKURENCJA.md](KONKURENCJA.md).
- **Model:** jeden gracz, offline, bez liczników. Płatność jednorazowa albo darmowy start
  z odblokowaniem pełnej gry.
- **Platformy:** Android najpierw, iOS z tego samego kodu (KMP), gdy będzie Mac.
- **Stos:** Kotlin Multiplatform + Compose Multiplatform, mapa MapLibre, dane wbudowane w grę.
- **Bez backendu** w wersji 1. Rankingi ewentualnie przez Play Games, jak w Urzędzie.

## Otwarte decyzje (do rozstrzygnięcia przed Plastrem 2)

1. Czas gry: ciągły z pauzą i przyspieszeniem (polecam) czy tury tygodniowe.
2. Epoka: tylko współczesność (polecam na start) czy kampania historyczna od lat 50.
3. Samoloty: prawdziwe nazwy czy zmyślone (patrz [DANE-I-LICENCJE.md](DANE-I-LICENCJE.md)).
4. Nazwa gry.

---

## Plaster 0: Spike techniczny (bramka „robimy / nie robimy tak”)

Cel: sprawdzić najryzykowniejszą rzecz, czyli mapę w Compose Multiplatform.

- Pusty projekt KMP (`shared` + `androidApp`), build z CLI.
- Mapa MapLibre w Compose, własny ciemny styl, kafle z paczki PMTiles.
- 4000 lotnisk jako warstwa punktów, płynne przesuwanie i zoom na średnim telefonie.
- Łuk ortodromy między dwoma lotniskami i ikona samolotu poruszająca się po nim.

**Gotowe, gdy:** APK pokazuje świat, lotniska i lecący samolot, bez przycięć.
**Jeśli się nie uda:** plan B to mapa rysowana samodzielnie na Canvas z danych Natural Earth
(mniej szczegółów, pełna kontrola), plan C to wersja webowa (MapLibre GL JS).

## Plaster 1: Dane świata

- `tools/`: skrypt pobiera OurAirports + GeoNames i buduje `data/processed/world.json`.
- Filtr lotnisk: duże i średnie z ruchem rozkładowym, długość pasa, strefa czasowa.
- Każde lotnisko dostaje **zlewnię**: sumę ludności miast w zasięgu dojazdu, ważoną odległością.
- Model popytu między parą lotnisk (grawitacyjny): zlewnia A × zlewnia B / odległość^β,
  z poprawkami na zamożność kraju i turystykę.
- Kalibracja na oko: Londyn–Nowy Jork ma wyjść ogromny, Radom–Szymany bliski zeru.

**Gotowe, gdy:** po dotknięciu dwóch lotnisk na mapie widać sensowną liczbę pasażerów dziennie.

## Plaster 2: Rdzeń symulacji (czysty Kotlin, testy)

- Zegar gry, flota, trasy, rozkład (ile rotacji dziennie mieści samolot).
- Przychód: popyt × funkcja ceny × wypełnienie. Koszty: paliwo, załoga, opłaty lotniskowe,
  obsługa techniczna, leasing.
- Raport finansowy tygodniowy, bankructwo.
- Zapis i odczyt stanu gry.

**Gotowe, gdy:** testy przechodzą, a symulacja 5 lat gry w testach daje wiarygodne wyniki
(zła trasa traci, dobra zarabia, nie da się zarabiać w nieskończoność jednym trikiem).

## Plaster 3: Pierwsza grywalna pętla (MVP)

- Wybór lotniska startowego (dowolne na świecie, podpowiedź: najbliższe graczowi).
- Jeden używany turbośmigłowiec i mały kapitał.
- Otwórz trasę → ustaw cenę i częstotliwość → patrz, jak lata → czytaj wynik → kup drugi samolot.
- Ekrany: mapa (główny), karta lotniska, karta trasy, flota, finanse.
- Samouczek w pierwszych 5 minutach.

**Gotowe, gdy:** obca osoba gra 20 minut bez tłumaczenia i chce grać dalej.
**To jest moment prawdy:** jeśli pętla nie bawi, wracamy do projektu zamiast dokładać funkcje.

## Plaster 4: Głębia

- **Kolej i drogi:** na krótkich trasach z dobrą koleją popyt lotniczy spada (dane z OSM).
- Konkurenci AI otwierający trasy i odpowiadający na ceny.
- Przesiadki: pasażer leci A→hub→B, więc hub zaczyna mieć sens.
- Sloty na zatłoczonych lotniskach, ograniczenia pasa i zasięgu.
- Rynek samolotów: nowe, używane, leasing, starzenie i przeglądy.
- Zdarzenia: ceny paliwa, sezonowość (wakacje, święta), strajki, pogoda.

## Plaster 5: Progresja i szlif

- Cele i etapy rozwoju: linia regionalna → krajowa → kontynentalna → globalna.
- Scenariusze startowe (np. „tani przewoźnik z Katowic”, „linia wyspiarska”).
- Malowanie i nazwa linii, klasy kabin, reputacja.
- Dźwięk, animacje, dopracowanie mapy, osiągnięcia.
- Wersja angielska (rynek gatunku jest głównie zagraniczny).

## Plaster 6: Wydanie

- Test zamknięty w Google Play, poprawki balansu.
- Strona sklepu, zrzuty, zwiastun.
- Ekran atrybucji licencji.
- iOS, gdy będzie Mac.

## Później (poza wersją 1)

- Tygodniowe wyzwanie z jednym seedem dla wszystkich i ranking.
- Kampania historyczna (od śmigłowców po odrzutowce).
- Cargo, sojusze, własne terminale.

---

## Największe ryzyka

| Ryzyko | Co z nim robimy |
|---|---|
| Mapa w Compose Multiplatform okaże się niedojrzała | Plaster 0 jest właśnie po to; plany B i C opisane |
| Gra okaże się „arkuszem z mapą”, bez frajdy | Plaster 3 jako twarda bramka, test na obcej osobie |
| Model popytu daje bzdury | kalibracja na znanych parach miast już w Plastrze 1 |
| Zatłoczony rynek | trzymać wyróżnik (geografia, offline, bez liczników), nie gonić liderów na funkcje |
| Rozmiar danych mapy | tylko małe przybliżenia, paczka PMTiles liczona w dziesiątkach MB |
