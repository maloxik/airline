# Dane i licencje

Stan na 2026-11-23. Przed wydaniem każdą licencję sprawdzić jeszcze raz u źródła.

## Mapa

### OpenStreetMap: tak, ale nie z serwerów OSM

- **Dane OSM są darmowe także komercyjnie** (licencja ODbL): wymagana widoczna atrybucja
  „© OpenStreetMap contributors”, a zmiany w samej bazie trzeba udostępniać na tej samej licencji.
- **Kafle z tile.openstreetmap.org nie nadają się do gry.** Fundacja pisze wprost, że nie są
  przeznaczone do użytku komercyjnego, a dostęp aplikacji może zostać zablokowany bez
  uprzedzenia ([zasady](https://operations.osmfoundation.org/policies/tiles/),
  [FAQ prawne](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ)).
- **Rozwiązanie: własne kafle wektorowe z danych OSM**, renderowane przez MapLibre:
  - paczka PMTiles (Protomaps) wbudowana w grę lub pobierana raz: działa offline, zero kosztów
    za wyświetlenia, własny styl graficzny (mapa wygląda jak gra, a nie jak nawigacja);
  - albo darmowy hosting kafli typu OpenFreeMap na etap prototypu.
  - Gra potrzebuje małych przybliżeń (świat → region), więc paczka jest mała; pełny świat do
    poziomu ulic to dziesiątki GB i nie jest potrzebny.

### Google Maps: odradzam

Do potwierdzenia w aktualnym regulaminie Google Maps Platform, ale z tego, co wiem:
opłata zależna od liczby wyświetleń, zakaz zapisywania kafli do pracy offline, ograniczone
stylowanie i obowiązkowe logo Google. Dla gry z jednorazową płatnością koszt rosnący z każdym
graczem to zły układ. Dedykowany produkt Google dla gier został wycofany kilka lat temu.

## Lotniska

- **[OurAirports](https://ourairports.com/data/)**: domena publiczna, aktualizowane codziennie,
  pliki CSV na [GitHubie](https://github.com/davidmegginson/ourairports-data): lotniska, pasy
  (długość ogranicza typ samolotu), kraje, regiony. Ok. 80 tys. obiektów, z czego do gry wchodzi
  kilka tysięcy (duże i średnie z ruchem rozkładowym).
- OpenFlights ma też bazę tras, ale stara (ok. 2014) i na ODbL. Niepotrzebna: trasy tworzy gracz.

## Miasta i ludność (źródło popytu)

- **GeoNames** (`cities15000`): miasta z liczbą ludności, CC BY 4.0, wymaga atrybucji.
- **Natural Earth**: granice państw i wybrzeża, domena publiczna.
- Do rozważenia później: siatka gęstości zaludnienia (GHSL, WorldPop) dla dokładniejszych
  stref dojazdu.

## Kolej i drogi (wyróżnik gry)

- Linie kolejowe dużych prędkości i autostrady z OSM (ODbL), przeliczone w `tools/` na prosty
  wskaźnik „czas dojazdu lądem między parą miast”. Liczone raz przy budowaniu danych, nie w grze.

## Znaki towarowe: uwaga

- **Nazwy linii lotniczych**: nie używać prawdziwych (LOT, Ryanair). Konkurenci AI dostają
  nazwy zmyślone.
- **Samoloty**: konkurencja powszechnie używa nazw Boeing/Airbus, ale to są znaki towarowe i
  ryzyko rośnie z popularnością gry. Bezpieczniej: zmyślone nazwy producentów z realistycznymi
  parametrami. Decyzja przed Plastrem 2.
- **Kody IATA/ICAO i nazwy lotnisk**: fakty, powszechnie używane.

## Ekran „O grze” musi zawierać

© OpenStreetMap contributors (ODbL) · GeoNames (CC BY 4.0) · OurAirports · Natural Earth · MapLibre
