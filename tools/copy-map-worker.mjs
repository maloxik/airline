// Kopiuje wątek roboczy MapLibre do public/maplibre, skąd aplikacja ładuje go pod stałym adresem.
// Uruchamia się samo przed `npm run dev` i `npm run build`, więc wersja zawsze zgadza się z zainstalowaną biblioteką.
import { cp, mkdir } from 'node:fs/promises';

const from = 'node_modules/maplibre-gl/dist/';
await mkdir('public/maplibre', { recursive: true });
// Nazwa z końcówką .js, bo serwer plików w aplikacji na telefonie pewniej podaje ją jako skrypt.
await cp(from + 'maplibre-gl-worker.mjs', 'public/maplibre/worker.js');
