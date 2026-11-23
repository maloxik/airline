# Projekt gry

Wersja 1, 2026-11-23. Dokument opisuje, czym gra ma być. Nie opisuje wyglądu ani ekranów.
Kolejność prac jest w [ROADMAPA.md](ROADMAPA.md), źródła danych w [DANE-I-LICENCJE.md](DANE-I-LICENCJE.md).

## 1. Założenie

Gracz zakłada linię lotniczą na prawdziwej mapie i prowadzi ją od jednego samolotu do sieci
połączeń. Świat nie jest wymyślony: lotniska, miasta, liczba mieszkańców, zamożność regionów,
ruch turystyczny i powiązania między krajami pochodzą z prawdziwych statystyk. Dzięki temu
decyzje gracza mają sens, który da się sprawdzić własną wiedzą o świecie: wiadomo, dlaczego
z Katowic lata się do Dortmundu, a z Rzeszowa do Nowego Jorku.

Trzy filary:

1. **Geografia decyduje.** Każda liczba w grze ma źródło w mapie.
2. **Budujesz firmę, a nie tylko trasy.** Flota, marka, ludzie, pieniądze, umowy z lotniskami.
3. **Jeden gracz, własne tempo.** Bez liczników, bez płacenia za przyspieszenie.

## 2. Platformy

**Rekomendacja: przeglądarka i Steam jako główne, telefon jako trzecia, wszystko z jednego kodu.**

| Platforma | Po co | Uwagi |
|---|---|---|
| Przeglądarka | darmowe demo, zasięg, szybkie testy po każdej zmianie | zero prowizji sklepu, link wystarczy, żeby zagrać |
| Steam | główna sprzedaż, płatność jednorazowa | tu jest publiczność gier ekonomicznych, która płaci za grę bez liczników; w 2026 na Steamie wyszło kilka nowych symulatorów linii lotniczych |
| Telefon | granie w przerwach, ta sama linia co na komputerze | płatne gry sprzedają się tu słabo, więc model „darmowy początek, jednorazowe odblokowanie” |

To moja ocena rynku, nie wynik badania: nie mam danych o sprzedaży konkurentów.

Co z tego wynika:

- **Interfejs musi działać na szerokim ekranie z myszą i na telefonie z kciukiem.** Projektowanie
  wyłącznie pod telefon odpada.
- **Zmiana stosu technicznego.** Wcześniej proponowałem Kotlin Multiplatform jak w Urzędzie.
  Przy przeglądarce i Steamie lepszy jest stos webowy: TypeScript, mapa MapLibre GL JS
  (najdojrzalsza wersja tej biblioteki), wdrożenie na Vercel po każdym commicie.
  Telefon przez opakowanie tej samej aplikacji (Capacitor), Steam przez opakowanie desktopowe
  (Tauri albo Electron). Rdzeń symulacji jako osobny moduł bez interfejsu, z testami.
- Zapis gry lokalnie, z opcjonalnym przenoszeniem między urządzeniami (kod albo konto) później.

## 3. Świat z prawdziwych danych

Zasada: **dane wejściowe są prawdziwe, wyniki są modelem.** Gra nie udaje, że zna prawdziwe
ceny biletów ani zyski linii. Zna prawdziwy świat i z niego wylicza popyt.

| Co | Skąd | Do czego w grze |
|---|---|---|
| Lotniska, pasy, położenie | OurAirports | gdzie można latać, jaki samolot wyląduje |
| Ludność w siatce 1 km | GHSL (Komisja Europejska) | zlewnia lotniska: ilu ludzi ma do niego blisko |
| Miasta i nazwy | GeoNames | podpisy, wyszukiwanie, opisy |
| Zamożność regionów | Eurostat (regiony NUTS), Bank Światowy (kraje) | ile osób stać na latanie i ile zapłacą |
| Noclegi turystów miesiąc po miesiącu | Eurostat | ruch wakacyjny i sezonowość każdego regionu |
| Skąd pochodzą migranci w każdym kraju | ONZ (International Migrant Stock) | ruch „do rodziny i do pracy” |
| Linie kolejowe i autostrady | OpenStreetMap | konkurencja lądowa na krótkich trasach |
| Prawdziwy ruch między lotniskami | Eurostat (transport lotniczy) | kalibracja: model ma dawać liczby podobne do rzeczywistych |

Europa ma najlepsze dane, więc gra zaczyna od Europy. Reszta świata dochodzi później,
z grubszymi danymi (kraje zamiast regionów).

### Popyt składa się z trzech rodzajów podróżnych

| Rodzaj | Z czego wynika | Jak się zachowuje |
|---|---|---|
| Służbowi | wielkość i zamożność obu miast, stolice | płacą dużo, chcą lotów rano i wieczorem, cały rok |
| Turyści | noclegi w regionie docelowym, zamożność regionu wylotu | wrażliwi na cenę, mocno sezonowi |
| Rodzina i praca | liczba migrantów między krajami | bardzo wrażliwi na cenę, szczyty w święta i wakacje |

Do tego transport lądowy odbiera część podróżnych na krótkich trasach.

Każde lotnisko ma kartę z prawdziwymi liczbami: ludność zlewni, zamożność, ilu turystów
przyjeżdża i w których miesiącach, z jakimi krajami region jest powiązany.

## 4. Systemy gry

### 4.1 Siatka połączeń

- Otwieranie tras z bazy, cena biletu, liczba lotów.
- **Otwarcie nowego lotniska to inwestycja**: stanowisko obsługi, umowa na obsługę naziemną,
  opłaty lotniskowe. Duże lotniska są drogie i mają ograniczoną liczbę slotów.
- **Druga i kolejne bazy**: samoloty nocują w bazie, więc nowa baza otwiera nowy region,
  ale kosztuje (hangar, załogi na miejscu).
- **Przesiadki**: gdy siatka ma lotnisko przesiadkowe, pasażer leci A → węzeł → B. To zmienia
  grę w połowie rozgrywki: nagle opłaca się latać w miejsca, które same nie zapełnią samolotu.
- Ograniczenia: zasięg samolotu, długość pasa, cisza nocna, prawa przewozowe poza Europą.

### 4.2 Flota

- Samoloty mają zmyślone nazwy i producentów, ale prawdziwe klasy i parametry:
  turbośmigłowy 70 miejsc, odrzutowiec regionalny 100, wąskokadłubowy 180,
  wąskokadłubowy dalekiego zasięgu 200, szerokokadłubowy 300.
- Parametry: miejsca, zasięg, spalanie, wymagany pas, czas obsługi na ziemi, załoga.
- **Trzy sposoby zdobycia samolotu**: nowy od producenta (taniej przy większym zamówieniu,
  ale czeka się miesiącami), używany z rynku (od ręki, starszy, droższy w utrzymaniu),
  leasing (bez wkładu, wysoka rata, łatwo oddać).
- Układ kabiny: gęsto i tanio albo luźniej z klasą biznes.
- Starzenie: rosną koszty obsługi i spalanie, spada wartość przy sprzedaży. Przeglądy
  wyłączają samolot z latania.
- Jednolita flota jest tańsza (jedne szkolenia, jedne części). Mieszana jest elastyczna.

### 4.3 Model biznesowy linii

Na starcie gracz wybiera charakter linii i może go zmieniać stopniowo:

- **Tania**: gęste kabiny, dopłaty za bagaż, małe lotniska, szybkie obroty.
- **Tradycyjna**: klasa biznes, przesiadki, duże lotniska, program lojalnościowy.
- **Regionalna**: małe samoloty, krótkie trasy, dopłaty od samorządów.

To nie są sztywne klasy, tylko punkty wyjścia. Mieszanie jest możliwe, ale kosztuje.

### 4.4 Marketing i marka

- **Znajomość marki jest na mapie.** W regionach, do których linia lata, ludzie ją znają.
  W nowym mieście nikt o niej nie słyszał, więc nowa trasa rozkręca się tygodniami.
- **Kampanie kieruje się w konkretne miejsce**: region, miasto albo trasę. Rodzaje: reklama
  zewnętrzna, internet, sponsoring lokalnego klubu albo wydarzenia, promocja na otwarcie trasy.
- **Reputacja** wynika z tego, jak linia działa: punktualność, odwołane loty, wiek samolotów,
  wygoda. Reputacji nie da się kupić reklamą, a złą trudno odbudować.
- Program lojalnościowy trzyma pasażerów służbowych, gdy rywal obniża ceny.
- Opinie pasażerów jako krótkie, konkretne sygnały, co nie działa.

### 4.5 Ludzie

Bez mikrozarządzania grafikami. Trzy grupy: piloci, personel pokładowy, mechanicy.

- Zatrudnianie i szkolenie trwa, więc rozwój floty trzeba planować z wyprzedzeniem.
- Płace kontra zadowolenie: niezadowolona załoga to spóźnienia, odejścia do rywala i strajki.

### 4.6 Finanse

- Rachunek tygodniowy: przychody z biletów i dopłat, paliwo, załogi, opłaty lotniskowe,
  obsługa techniczna, raty, marketing.
- Kredyt, leasing, sprzedaż samolotów, później inwestor albo giełda.
- Cena paliwa się waha. Można ją zabezpieczyć na kilka miesięcy naprzód.

### 4.7 Rywale

Linie sterowane przez grę, każda z charakterem:

- **Przewoźnik narodowy** siedzi w stolicy, broni swojego węzła, nie rusza się szybko.
- **Tani agresor** wchodzi na każdą dochodową trasę i zbija ceny.
- **Regionalny** trzyma kilka małych lotnisk.

Rywale reagują na ceny, wchodzą na trasy gracza, bankrutują. Później: przejęcie słabego
rywala, wspólne loty, sojusz.

### 4.8 Świat żyje

- Sezony i święta zmieniają popyt zgodnie z prawdziwym kalendarzem regionu.
- Wydarzenia w prawdziwych miejscach: mistrzostwa, festiwale, targi.
- Zakłócenia: zima, mgła, strajk kontrolerów, awaria samolotu.
- **Świat się zmienia w czasie gry**: otwiera się nowa linia szybkiej kolei i krótka trasa
  przestaje się opłacać, lotnisko dostaje nowy pas, kraj znosi wizy.

## 5. Przebieg rozgrywki

| Etap | Co gracz ma | Czego się uczy | Co dochodzi |
|---|---|---|---|
| Start | jedno lotnisko, 1–2 małe samoloty | popyt, cena, liczba lotów | zlewnia, konkurencja lądowa |
| Linia regionalna | 5–10 samolotów, kilkanaście tras | sezonowość, marka, używane samoloty | marketing, umowy z lotniskami |
| Linia krajowa | druga baza, odrzutowce | flota, ludzie, rywale | zamówienia u producenta, wojny cenowe |
| Linia europejska | węzeł przesiadkowy | przesiadki, sloty, reputacja | program lojalnościowy, przejęcia |
| Linia światowa | samoloty dalekiego zasięgu | prawa przewozowe, sojusze | reszta świata |

Tryby:

- **Kariera**: start z dowolnego lotniska, bez końca.
- **Scenariusze**: gotowa sytuacja z celem, np. „tania linia z Katowic”, „linia wyspiarska
  na Morzu Egejskim”, „uratuj bankruta”.
- **Wyzwanie tygodnia** (później): wszyscy dostają ten sam start, porównują wyniki.

## 6. Propozycje ode mnie

To są pomysły, których nie znalazłem u konkurencji albo które robią z mapy coś więcej niż tło.
Uszeregowane od tych, które uważam za najmocniejsze.

1. **Lotniska zabiegają o gracza.** Małe lotniska i ich samorządy składają oferty: zniżki
   w opłatach, dopłata do każdego pasażera, wspólna kampania reklamowa, w zamian za gwarancję
   lotów przez określony czas. Tak naprawdę działają tanie linie. Daje to negocjacje na mapie
   i powód, żeby latać do Radomia. Pasuje też do Twojego Urzędu: po drugiej stronie stołu
   siedzi marszałek województwa.

2. **Prawdziwe powiązania między ludźmi.** Ruch „do rodziny i do pracy” z danych o migracji
   sprawia, że mapa popytu wygląda jak prawdziwa: Podkarpacie lata do Stanów, Śląsk do Zagłębia
   Ruhry, Litwa do Irlandii. Żadna gra z tych, które widziałem, tego nie pokazuje, a to jest
   dokładnie to, na czym wyrosły prawdziwe tanie linie.

3. **Marka rozlewa się po mapie.** Znajomość linii to plama na mapie, która rośnie tam, gdzie
   linia lata i reklamuje się. Ekspansja przestaje być klikaniem w najlepsze liczby: opłaca się
   rosnąć od sąsiada do sąsiada albo świadomie zapłacić za skok w nowe miejsce.

4. **Świat z kalendarzem przyszłości.** Planowane naprawdę inwestycje (szybka kolej, nowe
   lotniska, rozbudowy) pojawiają się w grze w swoich przybliżonych terminach. Gracz, który
   czyta mapę, wie, że trasa ma przed sobą pięć dobrych lat, a potem zabierze ją pociąg.

5. **Pasażerowie mają twarz.** Zamiast samych procentów: krótkie, zmyślone, ale typowe
   postacie tłumaczące, kto lata daną trasą („pielęgniarka, co sześć tygodni do Bergen”,
   „student, raz w miesiącu do domu”). Robią z liczby powód i nadają grze ton.

6. **Start tam, gdzie mieszkasz.** Gra proponuje najbliższe lotnisko i pokazuje jego
   prawdziwą kartę. Każdy gracz zaczyna inną grę, a pierwsze decyzje sprawdza własną wiedzą
   o okolicy.

7. **Decyzje prezesa jako karty.** Rzadkie, konkretne wybory z konsekwencjami: związek żąda
   podwyżek, producent proponuje rabat za zamówienie dziś, rywal oferuje wspólne loty.
   Mechanikę kart masz już zrobioną w Urzędzie.

8. **Porównanie z rzeczywistością.** Po otwarciu trasy gra może pokazać, czy taka trasa
   naprawdę istnieje i ilu pasażerów nią lata (z danych Eurostatu). Buduje zaufanie do modelu
   i daje frajdę: „wymyśliłem trasę, którą ktoś naprawdę otworzył”.

## 6a. Dane: raz, przy budowaniu gry

Dane pobiera się raz i wbudowuje w grę jako gotową paczkę. Gra nie łączy się z żadnym
serwerem statystycznym. Powody: działa offline, nie ma kosztów serwera, każda rozgrywka jest
powtarzalna, a źródła i tak zmieniają się najwyżej raz w roku. Paczkę odświeża się przy
większych wydaniach. Ręcznie dopisywany jest tylko kalendarz przyszłych inwestycji i wydarzeń.

## 6b. Ruch i grafika

Mapa ma żyć cały czas. Statyczne kropki i linie odpadają.

**Ruch na mapie**
- Każdy lot jest widoczny: samolot startuje, leci po łuku, ląduje, stoi na ziemi podczas
  obsługi i wraca. Samoloty rywali też.
- Tempo: przy zwykłej prędkości doba w grze trwa około minuty, więc dwugodzinny lot widać
  przez kilka sekund. Przy przyspieszeniu pojedyncze samoloty zamieniają się w płynący ruch
  wzdłuż tras, żeby mapa nie migała.
- Granica dnia i nocy przesuwa się po mapie, w nocy świecą miasta.
- Pogoda jako przesuwające się fronty: zimą śnieg nad lotniskiem oznacza opóźnienia.
- Zdarzenia mają swój ruch: lądowanie daje krótki sygnał przy lotnisku, otwarcie trasy rysuje
  łuk, kampania reklamowa rozlewa znajomość marki po regionie, sezon zmienia odcień mapy.
- Technicznie: samoloty rysowane warstwą graficzną mapy, a nie elementami strony, bo tylko
  tak da się płynnie pokazać setki i tysiące lotów naraz.

**Prawdziwe lotniska z bliska**
- OpenStreetMap ma dokładne kształty pasów, dróg kołowania i płyt postojowych. Po przybliżeniu
  lotnisko wygląda jak prawdziwe, a na płycie stoją samoloty gracza w jego barwach.
  To tani sposób na mocne wrażenie, bo geometria jest gotowa.

**Samoloty i barwy**
- Pięć klas samolotów, każda z własną sylwetką: widok z boku (katalog, flota) i z góry (mapa,
  płyta lotniska). Rysowane wektorowo, żeby dobrze wyglądały w każdej wielkości.
- **Malowanie linii**: gracz wybiera kolory, wzór na kadłubie i znak na ogonie. Malowanie
  nakłada się automatycznie na każdy samolot, na mapie i w katalogu.
- Zmyślone typy, realistyczne proporcje. Bez prawdziwych nazw i znaków producentów.

**Zakup floty**
- Katalog producenta z sylwetkami w barwach gracza i porównaniem parametrów do tras, na
  których samolot miałby latać („zmieści się na pasie w Splicie, doleci do Londynu”).
- Rynek używanych: konkretne egzemplarze z wiekiem, przebiegiem i historią.
- Zamówiony samolot nie pojawia się znikąd: w dniu dostawy leci z fabryki do bazy i widać
  to na mapie. Pierwszy lot nowego typu jest małym wydarzeniem.
- Flota jako hangar: samoloty widać jako obiekty, ze stanem (leci, stoi, w przeglądzie).

## 7. Czego nie będzie w wersji 1

- gry wieloosobowej i serwera,
- reszty świata poza Europą (dochodzi po premierze),
- cargo,
- ręcznego układania rozkładu co do minuty,
- prawdziwych nazw linii i producentów samolotów.

## 8. Otwarte decyzje

| Decyzja | Moja rekomendacja |
|---|---|
| Platformy | przeglądarka i Steam główne, telefon trzeci |
| Stos | TypeScript + MapLibre GL JS, wdrożenie na Vercel |
| Zasięg mapy w wersji 1 | Europa z okolicami (Turcja, Afryka Północna, Kaukaz jako cele) |
| Czas gry | ciągły z pauzą i przyspieszeniem, rozliczenie co tydzień |
| Epoka | współczesność, start w roku wydania |
| Model sprzedaży | darmowe demo w przeglądarce, pełna gra płatna raz |
| Nazwa | do ustalenia |
