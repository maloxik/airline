// Buduje public/data/world.json z danych OurAirports (domena publiczna).
// Uruchamiane ręcznie: `npm run data`. Wynik trafia do repozytorium, gra nie pobiera niczego w trakcie działania.
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://davidmegginson.github.io/ourairports-data/';
// Europa z okolicami: od Azorów po Kaukaz, od Wysp Kanaryjskich po Spitsbergen.
const BOX = { latMin: 27, latMax: 72, lngMin: -32, lngMax: 50 };

/** Prosty parser CSV z obsługą cudzysłowów. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function get(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

const [airports, runways] = await Promise.all([get('airports.csv'), get('runways.csv')]);

const longest = new Map();
for (const r of runways) {
  if (r.closed === '1') continue;
  const m = Math.round(Number(r.length_ft) * 0.3048);
  if (m > (longest.get(r.airport_ident) ?? 0)) longest.set(r.airport_ident, m);
}

const out = [];
for (const a of airports) {
  if (a.type !== 'large_airport' && a.type !== 'medium_airport') continue;
  if (a.scheduled_service !== 'yes' || !/^[A-Z]{3}$/.test(a.iata_code)) continue;
  const lat = Number(a.latitude_deg);
  const lng = Number(a.longitude_deg);
  if (lat < BOX.latMin || lat > BOX.latMax || lng < BOX.lngMin || lng > BOX.lngMax) continue;
  out.push({
    iata: a.iata_code,
    icao: a.ident,
    name: a.name,
    city: a.municipality,
    country: a.iso_country,
    lng: Number(lng.toFixed(4)),
    lat: Number(lat.toFixed(4)),
    elevationM: Math.round(Number(a.elevation_ft || 0) * 0.3048),
    size: a.type === 'large_airport' ? 'L' : 'M',
    runwayM: longest.get(a.ident) ?? 0,
  });
}
out.sort((x, y) => x.iata.localeCompare(y.iata));

const world = {
  builtAt: new Date().toISOString().slice(0, 10),
  source: 'OurAirports (ourairports.com/data), domena publiczna',
  airports: out,
};
await mkdir('public/data', { recursive: true });
await writeFile('public/data/world.json', JSON.stringify(world));

const big = out.filter((a) => a.size === 'L').length;
console.log(`Lotniska: ${out.length} (duże ${big}, średnie ${out.length - big}), bez danych o pasie: ${out.filter((a) => !a.runwayM).length}`);
console.log(`Kraje: ${new Set(out.map((a) => a.country)).size}`);
