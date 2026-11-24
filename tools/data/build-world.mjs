// Buduje paczkę danych świata z prawdziwych źródeł. Uruchamiane ręcznie: `npm run data`.
// Wynik trafia do repozytorium (public/data), gra niczego nie pobiera w trakcie działania.
//
// Źródła:
//   OurAirports      lotniska i pasy (domena publiczna)
//   GeoNames         miejscowości z liczbą ludności, cities1000 (CC BY 4.0)
//   Eurostat         zamożność regionów NUTS 2, noclegi turystów zagranicznych wg miesięcy i regionów,
//                    obywatele innych krajów mieszkający w każdym kraju, ruch pasażerów między lotniskami
//   GISCO (Eurostat) granice regionów NUTS 2
//   Bank Światowy    zamożność krajów spoza danych Eurostatu (CC BY 4.0)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const CACHE = 'data-cache/';
const YEAR = 2023;
// Europa z okolicami: od Azorów po Kaukaz, od Wysp Kanaryjskich po Spitsbergen.
const BOX = { latMin: 27, latMax: 72, lngMin: -32, lngMax: 50 };
const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/';
const ROUTE_REPORTERS = 'be bg cz dk de ee ie el es fr hr it cy lv lt lu hu mt nl at pl pt ro si sk fi se is no ch'.split(' ');

await mkdir(CACHE, { recursive: true });
await mkdir('public/data', { recursive: true });

async function cached(name, url, binary = false) {
  const file = CACHE + name;
  if (existsSync(file)) return binary ? readFile(file) : readFile(file, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return binary ? buf : buf.toString('utf8');
}

/** Tabela Eurostatu (JSON-stat) jako lista wierszy {wymiar: kod, ..., value}. */
async function eurostat(dataset, params) {
  const qs = [['format', 'JSON'], ['lang', 'EN'], ...params].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const name = `${dataset}-${params.map((p) => p.join('_')).join('-').replace(/[^\w-]/g, '')}.json`.slice(0, 180);
  let d;
  try {
    d = JSON.parse(await cached(name, `${EUROSTAT}${dataset}?${qs}`));
  } catch (e) {
    console.warn(`  pominięto ${dataset}: ${e.message}`);
    return [];
  }
  if (!d.id) return [];
  const cats = d.id.map((id) => {
    const arr = [];
    for (const [code, i] of Object.entries(d.dimension[id].category.index)) arr[i] = code;
    return arr;
  });
  const rows = [];
  for (const [flat, value] of Object.entries(d.value)) {
    let n = Number(flat);
    const row = { value };
    for (let i = d.id.length - 1; i >= 0; i--) {
      row[d.id[i]] = cats[i][n % d.size[i]];
      n = Math.floor(n / d.size[i]);
    }
    rows.push(row);
  }
  return rows;
}

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

/** Wyciąga jeden plik z archiwum ZIP (bez zewnętrznych bibliotek). */
function unzipOne(buf, wanted) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const compSize = buf.readUInt32LE(p + 20);
    const local = buf.readUInt32LE(p + 42);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      return inflateRawSync(buf.subarray(start, start + compSize)).toString('utf8');
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  throw new Error(`brak ${wanted} w archiwum`);
}

const rad = (d) => (d * Math.PI) / 180;
function km(aLng, aLat, bLng, bLat) {
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const inBox = (lat, lng) => lat >= BOX.latMin && lat <= BOX.latMax && lng >= BOX.lngMin && lng <= BOX.lngMax;

// ---------------------------------------------------------------- lotniska
console.log('Lotniska (OurAirports)…');
const OA = 'https://davidmegginson.github.io/ourairports-data/';
const oaAirports = parseCsv(await cached('airports.csv', OA + 'airports.csv'));
const oaRunways = parseCsv(await cached('runways.csv', OA + 'runways.csv'));
const longest = new Map();
for (const r of oaRunways) {
  if (r.closed === '1') continue;
  const m = Math.round(Number(r.length_ft) * 0.3048);
  if (m > (longest.get(r.airport_ident) ?? 0)) longest.set(r.airport_ident, m);
}
const airports = [];
for (const a of oaAirports) {
  if (a.type !== 'large_airport' && a.type !== 'medium_airport') continue;
  if (a.scheduled_service !== 'yes' || !/^[A-Z]{3}$/.test(a.iata_code)) continue;
  const lat = Number(a.latitude_deg);
  const lng = Number(a.longitude_deg);
  if (!inBox(lat, lng)) continue;
  airports.push({
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
airports.sort((x, y) => x.iata.localeCompare(y.iata));
const byIcao = new Map(airports.map((a) => [a.icao, a]));

// ---------------------------------------------------------------- ludność i zlewnie
console.log('Ludność (GeoNames cities1000)…');
const citiesTxt = unzipOne(await cached('cities1000.zip', 'https://download.geonames.org/export/dump/cities1000.zip', true), 'cities1000.txt');
const SKIP = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']); // dzielnice i miejscowości historyczne liczyłyby ludzi podwójnie
const cities = [];
for (const lineTxt of citiesTxt.split('\n')) {
  const c = lineTxt.split('\t');
  if (c.length < 15 || SKIP.has(c[7])) continue;
  const lat = Number(c[4]);
  const lng = Number(c[5]);
  const pop = Number(c[14]);
  if (pop > 0 && lat >= BOX.latMin - 2 && lat <= BOX.latMax + 2 && lng >= BOX.lngMin - 2 && lng <= BOX.lngMax + 2) cities.push({ lat, lng, pop });
}
// Jak chętnie ludzie dojeżdżają na lotnisko z odległości d km: połowa przy 60 km, prawie nikt powyżej 150 km.
const reach = (d) => 1 / (1 + (d / 60) ** 3);
const grid = new Map();
const cell = (lat, lng) => `${Math.floor(lat / 2)}:${Math.floor(lng / 2)}`;
for (const a of airports) {
  a.catchRaw = 0;
  a.catch = 0;
  const k = cell(a.lat, a.lng);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(a);
}
for (const c of cities) {
  const near = [];
  const ci = Math.floor(c.lat / 2);
  const cj = Math.floor(c.lng / 2);
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 2; j <= cj + 2; j++) {
      for (const a of grid.get(`${i}:${j}`) ?? []) {
        const d = km(c.lng, c.lat, a.lng, a.lat);
        if (d < 200) near.push({ a, f: reach(d), w: (a.size === 'L' ? 1.5 : 1) * reach(d) });
      }
    }
  }
  if (!near.length) continue;
  const total = near.reduce((s, n) => s + n.w, 0);
  const best = Math.max(...near.map((n) => n.f));
  for (const n of near) {
    n.a.catchRaw += c.pop * n.f; // „ludzie w zasięgu”: liczeni przy każdym lotnisku, do którego mają blisko
    n.a.catch += c.pop * best * (n.w / total); // podział bez podwójnego liczenia: sąsiednie lotniska dzielą się ludźmi
  }
}
for (const a of airports) {
  a.catchRaw = Math.round(a.catchRaw);
  a.catch = Math.round(a.catch);
}

// ---------------------------------------------------------------- regiony NUTS 2
console.log('Regiony NUTS 2 (GISCO)…');
const nuts = JSON.parse(await cached('nuts2.geojson', 'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2021_4326_LEVL_2.geojson'));
const regions = nuts.features.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (const poly of polys) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { id: f.properties.NUTS_ID, polys, x0, x1, y0, y1 };
});
const inRing = (ring, x, y) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
function regionOf(lng, lat, country) {
  for (const r of regions) {
    if (lng < r.x0 || lng > r.x1 || lat < r.y0 || lat > r.y1) continue;
    for (const poly of r.polys) if (inRing(poly[0], lng, lat)) return r.id;
  }
  // Lotniska na wybrzeżu wypadają czasem poza uproszczoną granicę: bierzemy najbliższy region do 40 km.
  let best = null;
  let bestD = 40;
  for (const r of regions) {
    if (country && r.id.slice(0, 2) !== country) continue; // nie przypisujemy lotniska do regionu sąsiedniego kraju
    if (lng < r.x0 - 1 || lng > r.x1 + 1 || lat < r.y0 - 1 || lat > r.y1 + 1) continue;
    for (const poly of r.polys) for (const [x, y] of poly[0]) {
      const d = km(lng, lat, x, y);
      if (d < bestD) { bestD = d; best = r.id; }
    }
  }
  return best;
}
const nutsCountry = (c) => (c === 'GR' ? 'EL' : c === 'GB' ? 'UK' : c);
for (const a of airports) a.nuts = regionOf(a.lng, a.lat, nutsCountry(a.country)) ?? '';

// ---------------------------------------------------------------- zamożność
console.log('Zamożność (Eurostat, Bank Światowy)…');
const gdpRows = await eurostat('nama_10r_2gdp', [['unit', 'PPS_HAB_EU27_2020'], ['sinceTimePeriod', '2020']]);
const regionWealth = new Map();
for (const r of gdpRows.sort((x, y) => x.time.localeCompare(y.time))) regionWealth.set(r.geo, r.value); // najnowszy dostępny rok
const wb = JSON.parse(await cached('wb-gdp.json', `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.PP.CD?format=json&date=${YEAR}&per_page=400`))[1];
const wbGdp = new Map(wb.filter((r) => r.value).map((r) => [r.country.id, r.value]));
const euGdp = wbGdp.get('EU');
for (const a of airports) {
  const regional = regionWealth.get(a.nuts);
  const country = wbGdp.get(a.country);
  // Wskaźnik zamożności: średnia Unii = 100.
  a.wealth = Math.round(regional ?? (country && euGdp ? (100 * country) / euGdp : 60));
}

// ---------------------------------------------------------------- turystyka
console.log('Noclegi turystów zagranicznych (Eurostat, regiony × miesiące)…');
const nightRows = await eurostat('tour_occ_nin2m', [['c_resid', 'FOR'], ['unit', 'NR'], ['nace_r2', 'I551-I553'], ['time', String(YEAR)]]);
const regionNights = new Map();
for (const r of nightRows) {
  if (!/^M\d\d$/.test(r.month)) continue;
  if (!regionNights.has(r.geo)) regionNights.set(r.geo, new Array(12).fill(0));
  regionNights.get(r.geo)[Number(r.month.slice(1)) - 1] = r.value;
}
const inRegion = new Map();
for (const a of airports) {
  if (!inRegion.has(a.nuts)) inRegion.set(a.nuts, []);
  inRegion.get(a.nuts).push(a);
}
// Gdzie Eurostat nie ma danych (m.in. Wielka Brytania, Turcja, Afryka Północna): ostrożny szacunek z ludności, z łagodnym szczytem latem.
const FALLBACK_SEASON = [0.55, 0.6, 0.75, 0.95, 1.15, 1.35, 1.6, 1.6, 1.3, 1.0, 0.65, 0.5];
for (const a of airports) {
  const nights = regionNights.get(a.nuts);
  if (nights && nights.some((n) => n > 0)) {
    const mates = inRegion.get(a.nuts);
    const w = (x) => (x.size === 'L' ? 2 : 1);
    const share = w(a) / mates.reduce((s, m) => s + w(m), 0);
    a.nights = nights.map((n) => Math.round((n * share) / 1000)); // tysiące noclegów w miesiącu
    a.nightsEstimated = false;
  } else {
    // Ostrożnie: około jednego noclegu rocznie na mieszkańca, mniej w biedniejszych regionach.
    a.nights = FALLBACK_SEASON.map((s) => Math.round((a.catch * Math.min(1.2, a.wealth / 100) * s) / 12 / 1000));
    a.nightsEstimated = true;
  }
}

// ---------------------------------------------------------------- powiązania między krajami
console.log('Obywatele innych krajów (Eurostat)…');
const ctz = await eurostat('migr_pop1ctz', [['age', 'TOTAL'], ['sex', 'T'], ['time', String(YEAR)]]);
const ties = new Map();
const addTie = (from, to, people) => {
  if (from === to || !/^[A-Z]{2}$/.test(from) || !/^[A-Z]{2}$/.test(to)) return;
  const key = from < to ? `${from}-${to}` : `${to}-${from}`;
  ties.set(key, (ties.get(key) ?? 0) + people);
};
const fix = (c) => (c === 'EL' ? 'GR' : c === 'UK' ? 'GB' : c);
const AGGREGATES = new Set(['EU', 'EA', 'EF', 'TO', 'UN', 'ST', 'RN', 'NA', 'NE', 'EX']);
for (const r of ctz) {
  if (r.citizen.length !== 2 || r.geo.length !== 2 || AGGREGATES.has(r.citizen) || r.value < 3000) continue;
  addTie(fix(r.citizen), fix(r.geo), r.value);
}
// Wielka Brytania nie raportuje już do Eurostatu. Liczby przybliżone, wpisane z pamięci (spis 2021 i szacunki ONS);
// do zastąpienia danymi ONZ (International Migrant Stock) w kolejnym kroku.
const UK_APPROX = { PL: 700, RO: 540, IE: 410, IT: 280, ES: 190, FR: 180, PT: 165, LT: 150, DE: 140, BG: 130, HU: 90, LV: 80, GR: 80, NL: 70, TR: 70, SK: 60 };
for (const [c, thousands] of Object.entries(UK_APPROX)) addTie(c, 'GB', thousands * 1000);

// ---------------------------------------------------------------- prawdziwy ruch między lotniskami
console.log('Ruch pasażerów między lotniskami (Eurostat)…');
const real = new Map();
for (const cc of ROUTE_REPORTERS) {
  const rows = await eurostat(`avia_par_${cc}`, [['freq', 'A'], ['unit', 'PAS'], ['tra_meas', 'PAS_CRD'], ['time', String(YEAR)]]);
  for (const r of rows) {
    const p = r.airp_pr.split('_');
    const a = byIcao.get(p[1]);
    const b = byIcao.get(p[3]);
    if (!a || !b || a === b || !r.value) continue;
    const key = a.iata < b.iata ? `${a.iata}-${b.iata}` : `${b.iata}-${a.iata}`;
    real.set(key, Math.max(real.get(key) ?? 0, r.value)); // tę samą trasę raportują oba kraje: bierzemy pełniejszą liczbę
  }
}

// ---------------------------------------------------------------- zapis
const world = {
  builtAt: new Date().toISOString().slice(0, 10),
  year: YEAR,
  source: 'OurAirports, GeoNames, Eurostat, GISCO, Bank Światowy',
  airports,
  ties: [...ties].map(([k, v]) => [k, Math.round(v / 1000)]).filter(([, v]) => v >= 3).sort((x, y) => y[1] - x[1]),
};
await writeFile('public/data/world.json', JSON.stringify(world));
const routes = [...real].map(([k, v]) => [k, v]).sort((x, y) => y[1] - x[1]);
await writeFile('public/data/real-routes.json', JSON.stringify({ year: YEAR, source: 'Eurostat avia_par', routes }));

const sum = (f) => airports.reduce((s, a) => s + f(a), 0);
console.log(`\nLotniska: ${airports.length}, miejscowości: ${cities.length}`);
console.log(`Ludność przypisana do lotnisk: ${(sum((a) => a.catch) / 1e6).toFixed(0)} mln z ${(cities.reduce((s, c) => s + c.pop, 0) / 1e6).toFixed(0)} mln`);
console.log(`Regiony: ${airports.filter((a) => a.nuts).length} lotnisk w NUTS 2, zamożność regionalna u ${airports.filter((a) => regionWealth.has(a.nuts)).length}`);
console.log(`Turystyka z danych: ${airports.filter((a) => !a.nightsEstimated).length} lotnisk, szacowana: ${airports.filter((a) => a.nightsEstimated).length}`);
console.log(`Powiązania krajów: ${world.ties.length}, prawdziwe trasy: ${routes.length}`);
const show = (iata) => {
  const a = airports.find((x) => x.iata === iata);
  if (a) console.log(`  ${iata}: zlewnia ${(a.catch / 1e6).toFixed(2)} mln (w zasięgu ${(a.catchRaw / 1e6).toFixed(2)}), zamożność ${a.wealth}, region ${a.nuts}, noclegi lipiec ${a.nights[6]} tys., styczeń ${a.nights[0]} tys.${a.nightsEstimated ? ' (szac.)' : ''}`);
};
['KTW', 'KRK', 'WAW', 'RDO', 'LHR', 'LTN', 'DTM', 'SPU', 'PMI', 'IST'].forEach(show);
