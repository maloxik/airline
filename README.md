# Airline (nazwa robocza)

Symulator linii lotniczej na prawdziwej mapie: prawdziwe lotniska, prawdziwe miasta,
popyt wynikający z prawdziwej geografii.

Stan (2026-11-24): **faza 0 z roadmapy gotowa lokalnie.** Działa aplikacja z mapą Europy,
dniem i nocą, światłami miast i 685 prawdziwymi lotniskami. Rozgrywki jeszcze nie ma.
Repozytorium: github.com/maloxik/airline (prywatne, gałąź `main`). Gra jest na telefon: buduje się do pliku APK.

## Uruchomienie

```
npm install
npm run dev
```

| Polecenie | Co robi |
|---|---|
| `npm run dev` | aplikacja w trybie deweloperskim |
| `npm run check` | sprawdzenie typów i testy |
| `npm run build` | wersja do wdrożenia w `dist/` |
| `npm run android` | buduje grę i przenosi ją do projektu Androida w `android/` |
| `npm run data` | pobiera dane OurAirports i buduje od nowa `public/data/world.json` |

## Struktura

| Miejsce | Co tam jest |
|---|---|
| `src/sim/` | rdzeń gry: geografia, słońce, zegar, typy danych świata. Czysty TypeScript, bez przeglądarki i bez mapy, z testami |
| `src/app/` | aplikacja: mapa (MapLibre) i interfejs (React) |
| `tools/data/` | skrypty budujące dane świata z prawdziwych źródeł |
| `public/data/world.json` | zbudowana paczka danych, trzymana w repozytorium |
| `docs/` | projekt gry, roadmapa, licencje danych, mockupy |

`src/sim` ma osobne sprawdzenie typów bez dostępu do API przeglądarki (`tsconfig.sim.json`),
więc przypadkowe użycie `document` albo mapy w rdzeniu nie przejdzie `npm run check`.

## Dokumenty

- [docs/PROJEKT-GRY.md](docs/PROJEKT-GRY.md) — czym gra ma być: systemy, dane, platformy, własne propozycje
- [docs/ROADMAPA.md](docs/ROADMAPA.md) — plan w fazach, od danych do wydania
- [docs/KONKURENCJA.md](docs/KONKURENCJA.md) — co już istnieje i gdzie jest luka
- [docs/DANE-I-LICENCJE.md](docs/DANE-I-LICENCJE.md) — mapy, lotniska, miasta: skąd brać i na jakich warunkach
- [docs/OPIS-GRY.md](docs/OPIS-GRY.md) — opis gry do wklejenia w inne AI, bez sugestii interfejsu
- [docs/mockup/v6-telefon.html](docs/mockup/v6-telefon.html) — zaakceptowany mockup wyglądu i rozgrywki, wzorzec dla aplikacji

## Stos

TypeScript, Vite, React, MapLibre GL JS. Mapa bazowa z OpenFreeMap (dane OpenStreetMap),
światła nocne z NASA GIBS, lotniska z OurAirports. Gra jest opakowana w aplikację na telefon
narzędziem Capacitor (`android/`). Przeglądarka służy tylko do podglądu przy pracy.

## Plik APK

```
npm run android
cd android
./gradlew assembleDebug
```

Wymaga Javy 21 (`JAVA_HOME`) i Android SDK. Wynik: `android/app/build/outputs/apk/debug/app-debug.apk`.
