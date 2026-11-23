# Airline (nazwa robocza)

Symulator linii lotniczej na prawdziwej mapie świata: prawdziwe lotniska, prawdziwe miasta,
popyt wynikający z prawdziwej geografii.

Stan: **pomysł + roadmapa** (2026-11-23). Kodu jeszcze nie ma.

## Dokumenty

- [docs/ROADMAPA.md](docs/ROADMAPA.md) — plan w plastrach, od spike'a technicznego do sklepu
- [docs/KONKURENCJA.md](docs/KONKURENCJA.md) — co już istnieje i gdzie jest luka
- [docs/DANE-I-LICENCJE.md](docs/DANE-I-LICENCJE.md) — mapy, lotniska, miasta: skąd brać i na jakich warunkach

## Struktura

| Folder | Na co |
|---|---|
| `shared/` | rdzeń gry w czystym Kotlinie (KMP): symulacja, ekonomia, zapis — bez UI, z testami |
| `androidApp/` | aplikacja Android (Compose) |
| `iosApp/` | aplikacja iOS (czeka na Maca, jak w Urzędzie) |
| `tools/` | skrypty budujące dane gry z surowych źródeł |
| `data/raw/` | pobrane surowe zbiory (OurAirports, GeoNames…) — nie commitować dużych plików |
| `data/processed/` | gotowe paczki danych wchodzące do gry |
| `assets/` | grafika i dźwięk |
| `docs/` | projekt gry, plany, decyzje |

## Proponowany stos

Kotlin Multiplatform + Compose Multiplatform (ten sam układ co w Urzędzie), mapa przez MapLibre
z wektorowymi kaflami opartymi o OpenStreetMap. Uzasadnienie i ryzyka: ROADMAPA, Plaster 0.
