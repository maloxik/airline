# Opis gry (brief dla AI)

Ten plik jest samowystarczalny: wklej go w całości do dowolnego narzędzia AI. Opisuje grę,
a nie jej wygląd. Interfejs, układ ekranów i styl graficzny są do wymyślenia.

---

## 1. Gra w jednym zdaniu

Symulator linii lotniczej, w którym gra toczy się na prawdziwej mapie świata, a popyt na loty
wynika z prawdziwej geografii: z tego, ilu ludzi mieszka w pobliżu lotniska i czy między
miastami nie da się szybciej dojechać pociągiem albo samochodem.

## 2. Podstawowe fakty

- **Urządzenie:** telefon trzymany pionowo, obsługa dotykiem.
- **Tryb:** jeden gracz, działa bez internetu. Bez liczników czasu, bez waluty premium, bez reklam.
- **Język:** polski (ze znakami ą ć ę ł ń ó ś ź ż).
- **Odbiorca:** dorosły, który lubi lotnictwo, mapy i gry ekonomiczne. Chce się czuć jak
  szef linii lotniczej, a nie jak księgowy.
- **Nazwa robocza:** Airline. Przykładowa linia gracza: „Silesia Air” (zmyślona).
- **Ograniczenie prawne:** bez prawdziwych nazw i logo linii lotniczych oraz producentów samolotów.

## 3. Świat gry

- Prawdziwa mapa świata z prawdziwymi lotniskami (kilka tysięcy) i miastami.
- Każde lotnisko ma **zlewnię**: liczbę ludzi, którzy dojadą do niego w 90 minut. Katowice
  mają 4,6 mln, Radom 0,4 mln, Londyn 12 mln.
- Popyt na loty między dwoma lotniskami rośnie z wielkością obu zlewni i maleje z odległością.
- **Transport lądowy konkuruje z samolotem.** Tam, gdzie jeździ szybki pociąg albo jest
  blisko autostradą, większość ludzi nie leci. Katowice–Warszawa: pociąg jedzie 2 h 20 min
  i zabiera 80% podróżnych. Katowice–Kraków: nikt nie poleci, bo to godzina samochodem.
- Część kierunków jest sezonowa: Split zimą jest pusty, w lipcu popyt rośnie czterokrotnie.
- Czas płynie ciągle. Gracz może go zatrzymać albo przyspieszyć.
- Na tej samej mapie działają linie-rywale sterowane przez grę.

## 4. Co robi gracz

1. Wybiera lotnisko, z którego zaczyna, najlepiej swoje lokalne. Dostaje jeden mały samolot
   (70 miejsc) i trochę pieniędzy.
2. Szuka kierunków, na które warto latać. O każdym lotnisku może się dowiedzieć, ilu ludzi
   dziennie chce tam lecieć z jego bazy i ile taka trasa mogłaby zarobić.
3. Otwiera trasę i decyduje o dwóch rzeczach: cenie biletu i liczbie rotacji dziennie.
   Wyższa cena to mniej chętnych, więcej rotacji to więcej miejsc i wyższe koszty.
4. Obserwuje, jak jego samoloty latają i jak trasy sobie radzą.
5. Co tydzień dostaje wynik finansowy. Dobre trasy zarabiają, złe tracą.
6. Poprawia: zmienia ceny, dokłada lub zdejmuje rotacje, zamyka trasy, otwiera nowe.
7. Za zysk kupuje albo bierze w leasing kolejne samoloty, z czasem większe i o dłuższym zasięgu.
8. Rośnie: linia regionalna → krajowa → kontynentalna → globalna. Po drodze reaguje na
   rywali, sezony, ceny paliwa i zdarzenia losowe.

## 5. Co gracz musi wiedzieć, żeby dobrze decydować

O swojej linii:
- stan konta i wynik ostatniego tygodnia,
- aktualną datę i godzinę w grze, tempo upływu czasu.

O lotnisku:
- nazwę miasta i kod trzyliterowy, odległość od bazy,
- wielkość zlewni,
- popyt dzienny z bazy gracza,
- czy i jak mocno konkuruje z nim transport lądowy,
- szacowany wynik trasy, zanim ją otworzy.

O trasie, którą już lata:
- wypełnienie samolotów,
- liczbę pasażerów dziennie,
- wynik tygodnia,
- ilu chętnych nie zmieściło się do samolotu,
- podział podróżnych między samolot a ląd,
- obecną cenę biletu i liczbę rotacji, z możliwością zmiany.

O flocie:
- jakie ma samoloty (liczba miejsc, zasięg, wiek), które są przypisane do tras, które stoją,
- ofertę rynku: nowe, używane, leasing.

O finansach:
- przychody i koszty tygodnia (paliwo, załogi, opłaty lotniskowe, obsługa techniczna, leasing),
- jak zmieniał się stan konta, kredyt.

O rywalach:
- gdzie latają i czy wchodzą na jego trasy.

## 6. Co ma być w tej grze wyjątkowe

To są rzeczy, które odróżniają ją od innych symulatorów linii lotniczych. Gracz powinien
je rozumieć bez czytania instrukcji:

- **Geografia decyduje.** Trasa jest dobra albo zła z powodów, które widać na mapie: wielkie
  miasto, mała wieś, góry, morze, linia kolejowa.
- **Kolej i drogi są przeciwnikiem.** Krótkie trasy przegrywają z lądem tak jak w rzeczywistości.
- **Zaczynasz u siebie.** Pierwsze lotnisko to lotnisko gracza, a pierwsze trasy to te,
  którymi sam mógłby polecieć.
- **Decyzja i skutek są blisko siebie.** Zmiana ceny albo liczby rotacji od razu pokazuje,
  co się stanie z wypełnieniem i wynikiem.

## 7. Przykładowy stan gry

Linia: Silesia Air · baza: Katowice (KTW) · konto: 4 820 000 zł · wynik tygodnia: +98 000 zł ·
data: wtorek 16 lutego 2027, godz. 08:00 · flota: 4 samoloty po 70 miejsc.

| Trasa | Odległość | Rotacje dziennie | Wypełnienie | Wynik tygodnia | Uwaga |
|---|---|---|---|---|---|
| Katowice → Warszawa (WAW) | 229 km | 3 | 45% | −77 000 zł | kolej 2 h 20 zabiera 80% podróżnych |
| Katowice → Dortmund (DTM) | 830 km | 2 | 100% | +105 000 zł | stabilny ruch pracowniczy |
| Katowice → Londyn Luton (LTN) | 1400 km | 1 | 100% | +46 000 zł | 117 chętnych dziennie nie mieści się |
| Katowice → Bergamo (BGY) | 880 km | 1 | 100% | +52 000 zł | |
| Katowice → Split (SPU) | 800 km | 1 | 33% | −29 000 zł | sezonowa, w lipcu popyt ×4 |

Lotnisko, na które gracz jeszcze nie lata: Amsterdam (AMS), 1012 km, zlewnia 8 mln,
popyt 187 osób dziennie, szacowany wynik +50 000 zł tygodniowo przy jednej rotacji.

Rywal lata z Warszawy do Paryża, Frankfurtu i Sztokholmu oraz z Krakowa do Londynu.

Inne lotniska w okolicy: Kraków, Wrocław, Poznań, Gdańsk, Rzeszów, Radom, Berlin, Praga,
Wiedeń, Budapeszt, Monachium, Frankfurt, Paryż, Kopenhaga, Oslo, Sztokholm, Rzym,
Barcelona, Madryt, Ateny, Stambuł, Burgas.

---

## Gotowe polecenia

### Dla AI, które buduje klikalny interfejs

> Przeczytaj powyższy opis gry. Zaprojektuj od zera jej interfejs na telefon w układzie
> pionowym i zbuduj klikalny mockup z danymi z punktu 7. Opis celowo nie mówi, jak gra ma
> wyglądać ani jak ułożyć ekrany: to Twoja decyzja. Zanim zaczniesz budować, napisz krótko,
> jaki pomysł na interfejs wybrałeś i dlaczego pasuje do tej gry. Interfejs po polsku.

### Dla AI, które generuje obrazy (po angielsku)

> Design the mobile UI (portrait) for an original airline management game played on a real
> world map. The player runs "Silesia Air" from Katowice, Poland, flying routes to Warsaw,
> Dortmund, London, Bergamo and Split. Demand depends on real geography: how many people
> live within 90 minutes of each airport, and whether rail or road beats the plane on short
> routes (the Warsaw route is losing money because 80% of travellers take the train).
> The player sets ticket prices and daily rotations and sees load factor and weekly profit
> change. Show the moment the player looks at the loss-making Katowice–Warsaw route:
> 229 km, 45% load factor, 189 passengers a day, −77 000 zł a week. Account balance
> 4 820 000 zł. All text in Polish. Invent the layout and the visual style yourself.
> No real airline or aircraft manufacturer names or logos.
