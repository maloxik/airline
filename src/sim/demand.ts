/**
 * Popyt: ilu ludzi chce podróżować między dwoma lotniskami.
 *
 * Wejście jest prawdziwe (ludność w zasięgu lotnisk, zamożność regionów, noclegi turystów w kolejnych
 * miesiącach, obywatele jednego kraju mieszkający w drugim). Wynik jest modelem, dopasowanym do
 * prawdziwego ruchu między lotniskami skryptem tools/data/calibrate.ts.
 */
import { distanceKm, type LngLat } from './geo';
import type { Airport, RealRoutes, WorldData } from './world';
import fitted from './demand-params.json';

export interface DemandParams {
  /** Skala podróży służbowych. */
  kBusiness: number;
  /** Jaka część turystów zagranicznych regionu przylatuje samolotem przez to lotnisko. */
  kTourism: number;
  /** Skala podróży do rodziny i do pracy. */
  kVfr: number;
  /** Jak szybko chęć podróży służbowej spada z odległością. */
  betaBusiness: number;
  betaTourism: number;
  betaVfr: number;
  /** Jak mocno zamożność regionu przekłada się na latanie. */
  wealthPower: number;
  /** Ile razy silniejsze są powiązania wewnątrz jednego kraju. */
  domesticBoost: number;
}

export const DEFAULT_PARAMS: DemandParams = fitted;

export interface Demand {
  /** Pasażerowie dziennie w jedną stronę, którzy polecą samolotem. */
  air: number;
  /** Wszyscy podróżni dziennie w jedną stronę, razem z tymi, którzy wybiorą ląd. */
  natural: number;
  /** Część podróżnych, która wybierze pociąg albo samochód (0–1). */
  landShare: number;
  /** Podział podróżnych samolotem według powodu podróży. */
  business: number;
  tourism: number;
  vfr: number;
  distanceKm: number;
}

/** Dane świata ułożone do szybkiego liczenia popytu. */
export interface WorldIndex {
  airports: Map<string, Airport>;
  /** Suma ludności przypisanej do lotnisk w każdym kraju. */
  countryCatch: Map<string, number>;
  /** Powiązania między krajami w tysiącach osób; klucz 'DE-PL' (alfabetycznie). */
  ties: Map<string, number>;
  /** Prawdziwy ruch na trasach: klucz 'DTM-KTW' (alfabetycznie) → pasażerów w roku w obu kierunkach. */
  realTraffic: Map<string, number>;
  /** Pamięć podręczna: suma „skąd mogą przyjechać turyści” dla każdego lotniska, osobno dla każdego zestawu parametrów. */
  tourismReach: Map<string, Map<string, number>>;
}

/** Średnia długość pobytu turysty zagranicznego w noclegach. */
const NIGHTS_PER_TRIP = 5;

export function indexWorld(world: WorldData, real?: RealRoutes | null): WorldIndex {
  const countryCatch = new Map<string, number>();
  for (const a of world.airports) countryCatch.set(a.country, (countryCatch.get(a.country) ?? 0) + a.catch);
  return {
    airports: new Map(world.airports.map((a) => [a.iata, a])),
    countryCatch,
    ties: new Map(world.ties),
    realTraffic: new Map(real?.routes ?? []),
    tourismReach: new Map(),
  };
}

const position = (a: Airport): LngLat => [a.lng, a.lat];
/** Kraje, do których nie dojedzie się lądem bez promu albo tunelu. */
const ISLANDS = new Set(['GB', 'IE', 'IS', 'MT', 'CY']);

/**
 * Jaka część podróżnych wybierze ląd zamiast samolotu.
 * Wersja tymczasowa: zależy tylko od odległości i od tego, czy po drodze jest morze.
 * Docelowo policzona z prawdziwych linii kolejowych i dróg (OpenStreetMap).
 */
export function landShare(a: Airport, b: Airport, km: number, halfAtKm = 380): number {
  const byDistance = 1 / (1 + (km / halfAtKm) ** 3.2);
  const seaBetween = a.country !== b.country && (ISLANDS.has(a.country) || ISLANDS.has(b.country));
  return seaBetween ? byDistance * 0.15 : byDistance;
}
/** Przy jakiej odległości połowa podróżnych wybiera ląd. Urlopowicze i odwiedzający rodzinę jadą samochodem dalej niż podróżni służbowi. */
const LAND_HALF_KM = { business: 380, tourism: 650, vfr: 550 } as const;

const mass = (a: Airport, p: DemandParams): number => (a.catch / 1e6) * (a.wealth / 100) ** p.wealthPower;

/**
 * Dla każdego lotniska: suma po wszystkich pozostałych z (ludność × zamożność) / odległość^beta.
 * Dzięki niej turyści jednego regionu są dzieleni między miasta, z których przyjeżdżają,
 * zamiast być przypisani każdemu miastu w całości.
 */
function tourismReach(index: WorldIndex, p: DemandParams): Map<string, number> {
  const key = `${p.betaTourism}|${p.wealthPower}`;
  let reach = index.tourismReach.get(key);
  if (reach) return reach;
  reach = new Map();
  const all = [...index.airports.values()];
  const masses = all.map((a) => mass(a, p));
  for (const b of all) {
    let sum = 0;
    for (let i = 0; i < all.length; i++) {
      const a = all[i]!;
      if (a === b) continue;
      sum += masses[i]! / Math.max(distanceKm(position(a), position(b)), 60) ** p.betaTourism;
    }
    reach.set(b.iata, sum || 1);
  }
  if (index.tourismReach.size > 4) index.tourismReach.clear();
  index.tourismReach.set(key, reach);
  return reach;
}

/** Popyt między dwoma lotniskami w danym miesiącu (0 = styczeń). */
export function demand(index: WorldIndex, a: Airport, b: Airport, month: number, p: DemandParams = DEFAULT_PARAMS): Demand {
  const km = distanceKm(position(a), position(b));
  if (a === b || km < 1) return { air: 0, natural: 0, landShare: 1, business: 0, tourism: 0, vfr: 0, distanceKm: km };
  const d = Math.max(km, 60);
  const massA = mass(a, p);
  const massB = mass(b, p);
  const domestic = a.country === b.country;

  const business = (p.kBusiness * massA * massB * (domestic ? p.domesticBoost : 1)) / d ** p.betaBusiness;

  const m = ((month % 12) + 12) % 12;
  // Przyjazdy turystów dziennie: noclegi regionu w miesiącu → podróże, podzielone między miasta pochodzenia.
  const reach = tourismReach(index, p);
  const arrivals = (x: Airport): number => ((x.nights[m] ?? 0) * 1000) / NIGHTS_PER_TRIP / 30;
  const pull = d ** -p.betaTourism;
  const tourism =
    p.kTourism * ((arrivals(b) * massA * pull) / (reach.get(b.iata) ?? 1) + (arrivals(a) * massB * pull) / (reach.get(a.iata) ?? 1));

  let vfr = 0;
  if (!domestic) {
    const key = a.country < b.country ? `${a.country}-${b.country}` : `${b.country}-${a.country}`;
    const tie = index.ties.get(key) ?? 0;
    const shareA = a.catch / (index.countryCatch.get(a.country) || a.catch || 1);
    const shareB = b.catch / (index.countryCatch.get(b.country) || b.catch || 1);
    vfr = (p.kVfr * tie * shareA * shareB) / d ** p.betaVfr;
  }

  const natural = business + tourism + vfr;
  const airBusiness = business * (1 - landShare(a, b, km, LAND_HALF_KM.business));
  const airTourism = tourism * (1 - landShare(a, b, km, LAND_HALF_KM.tourism));
  const airVfr = vfr * (1 - landShare(a, b, km, LAND_HALF_KM.vfr));
  const air = airBusiness + airTourism + airVfr;
  return { air, natural, landShare: natural > 0 ? 1 - air / natural : 1, business: airBusiness, tourism: airTourism, vfr: airVfr, distanceKm: km };
}

/** Średni popyt lotniczy w roku: pasażerowie dziennie w jedną stronę. */
export function yearlyAverageDemand(index: WorldIndex, a: Airport, b: Airport, p: DemandParams = DEFAULT_PARAMS): number {
  let sum = 0;
  for (let m = 0; m < 12; m++) sum += demand(index, a, b, m, p).air;
  return sum / 12;
}
