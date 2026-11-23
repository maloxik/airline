# Airline (nazwa robocza)

Symulator linii lotniczej na prawdziwej mapie świata: prawdziwe lotniska, prawdziwe miasta,
popyt wynikający z prawdziwej geografii.

Stan: **pomysł + roadmapa** (2026-11-23). Kodu jeszcze nie ma.

## Dokumenty

- [docs/PROJEKT-GRY.md](docs/PROJEKT-GRY.md) — czym gra ma być: systemy, dane, platformy, własne propozycje
- [docs/ROADMAPA.md](docs/ROADMAPA.md) — plan w fazach, od danych do wydania
- [docs/KONKURENCJA.md](docs/KONKURENCJA.md) — co już istnieje i gdzie jest luka
- [docs/DANE-I-LICENCJE.md](docs/DANE-I-LICENCJE.md) — mapy, lotniska, miasta: skąd brać i na jakich warunkach
- [docs/OPIS-GRY.md](docs/OPIS-GRY.md) — opis gry do wklejenia w inne AI, bez sugestii interfejsu
- [docs/mockup/](docs/mockup/index.html) — klikalne mockupy ekranu głównego (wymagają serwera i internetu): v2–v4 wcześniejsze kierunki, v5 żywa mapa pod szeroki ekran (aktualny)

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

Rekomendacja z 2026-11-23 (do zatwierdzenia): TypeScript + MapLibre GL JS, wdrożenie na Vercel;
przeglądarka i Steam jako główne platformy, telefon przez opakowanie tej samej aplikacji.
Wcześniejszy pomysł (Kotlin Multiplatform) i układ folderów poniżej są do zmiany w fazie 0.
