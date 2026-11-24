/**
 * Linia lotnicza gracza: flota, trasy i pieniądze.
 * Wszystkie funkcje są czyste: dostają stan gry i zwracają nowy, niczego nie zmieniając w miejscu.
 */
import { demand, type WorldIndex } from './demand';
import { distanceKm } from './geo';
import type { Airport } from './world';

export interface AircraftType {
  id: string;
  maker: string;
  name: string;
  seats: number;
  rangeKm: number;
  speedKmh: number;
  /** Najkrótszy pas, z którego typ może regularnie latać. */
  runwayM: number;
  /** Rata leasingu za tydzień, w złotych. */
  leaseWeekly: number;
  /** Koszt jednego lotu niezależny od odległości (obsługa, opłaty, załoga). */
  fixedPerFlight: number;
  /** Koszt każdego kilometra lotu (paliwo, zużycie). */
  costPerKm: number;
  kind: 'tp' | 'jet';
}

/** Prawdziwe typy. Parametry przybliżone; koszty dobrane pod balans gry, nie z cenników. */
export const AIRCRAFT: readonly AircraftType[] = [
  { id: 'AT76', maker: 'ATR', name: '72-600', seats: 72, rangeKm: 1400, speedKmh: 510, runwayM: 1300, leaseWeekly: 18_000, fixedPerFlight: 4000, costPerKm: 12, kind: 'tp' },
  { id: 'DH8D', maker: 'De Havilland Canada', name: 'Dash 8-400', seats: 78, rangeKm: 2000, speedKmh: 667, runwayM: 1400, leaseWeekly: 20_000, fixedPerFlight: 4300, costPerKm: 13, kind: 'tp' },
  { id: 'E295', maker: 'Embraer', name: 'E195-E2', seats: 132, rangeKm: 4800, speedKmh: 830, runwayM: 1900, leaseWeekly: 55_000, fixedPerFlight: 7000, costPerKm: 20, kind: 'jet' },
  { id: 'BCS3', maker: 'Airbus', name: 'A220-300', seats: 145, rangeKm: 6300, speedKmh: 830, runwayM: 1900, leaseWeekly: 62_000, fixedPerFlight: 7500, costPerKm: 21, kind: 'jet' },
  { id: 'A20N', maker: 'Airbus', name: 'A320neo', seats: 180, rangeKm: 6300, speedKmh: 830, runwayM: 2000, leaseWeekly: 78_000, fixedPerFlight: 9000, costPerKm: 25, kind: 'jet' },
  { id: 'B38M', maker: 'Boeing', name: '737 MAX 8', seats: 178, rangeKm: 6500, speedKmh: 840, runwayM: 2300, leaseWeekly: 76_000, fixedPerFlight: 9000, costPerKm: 25, kind: 'jet' },
];
const TYPES = new Map(AIRCRAFT.map((t) => [t.id, t]));
export function aircraftType(id: string): AircraftType {
  const t = TYPES.get(id);
  if (!t) throw new Error(`nieznany typ samolotu: ${id}`);
  return t;
}

export interface Plane {
  /** Znak rejestracyjny, np. SP-SAA. */
  reg: string;
  typeId: string;
  /** Kod lotniska docelowego trasy, na której samolot lata; null, gdy stoi wolny w bazie. */
  routeTo: string | null;
}

export interface Route {
  /** Kod lotniska docelowego. Trasy zaczynają się w bazie. */
  to: string;
  /** Loty tam i z powrotem w ciągu doby. */
  rotations: number;
  /** Cena biletu względem typowej dla tej odległości: 1 = typowa. */
  priceFactor: number;
  planeReg: string;
}

export interface GameState {
  airlineName: string;
  baseIata: string;
  cash: number;
  fleet: Plane[];
  routes: Route[];
}

export const STARTING_CASH = 3_000_000;
export const TURNAROUND_MIN = 35;
/** Pierwszy odlot z bazy: 6:00 czasu lokalnego. Samoloty pracują do późnego wieczora. */
const FIRST_DEPARTURE_MIN = 6 * 60;
const WORKING_DAY_MIN = 17 * 60;
const PRICE_MIN = 0.5;
const PRICE_MAX = 2;
/** Jak mocno liczba chętnych reaguje na cenę. */
const PRICE_ELASTICITY = 1.6;

/** Dwie litery do znaków rejestracyjnych, z nazwy linii. */
function initials(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/);
  const first = words[0] ?? 'X';
  const raw = (first[0] ?? 'X') + (words[1]?.[0] ?? first[1] ?? 'X');
  return raw.replace(/[^A-Z]/g, 'X');
}

export function newGame(baseIata: string, airlineName: string): GameState {
  return {
    airlineName,
    baseIata,
    cash: STARTING_CASH,
    fleet: [{ reg: `SP-${initials(airlineName)}A`, typeId: 'AT76', routeTo: null }],
    routes: [],
  };
}

/** Typowa cena biletu w jedną stronę na danej odległości, w złotych. */
export const typicalPrice = (km: number): number => 120 + 0.16 * km;
export const flightMinutes = (km: number, type: AircraftType): number => (km / type.speedKmh) * 60 + 18;
/** Ile lotów tam i z powrotem samolot zmieści w ciągu dnia pracy. */
export function maxRotations(km: number, type: AircraftType): number {
  return Math.max(1, Math.min(6, Math.floor(WORKING_DAY_MIN / (2 * (flightMinutes(km, type) + TURNAROUND_MIN)))));
}

const need = (index: WorldIndex, iata: string): Airport => {
  const a = index.airports.get(iata);
  if (!a) throw new Error(`nieznane lotnisko: ${iata}`);
  return a;
};
export const routeKm = (index: WorldIndex, state: GameState, to: string): number => {
  const a = need(index, state.baseIata);
  const b = need(index, to);
  return distanceKm([a.lng, a.lat], [b.lng, b.lat]);
};

export interface RouteEconomics {
  km: number;
  flightMin: number;
  price: number;
  /** Chętni dziennie w jedną stronę przy typowej cenie. */
  potential: number;
  /** Chętni dziennie w jedną stronę przy obecnej cenie. */
  wanting: number;
  /** Miejsca dziennie w jedną stronę. */
  seats: number;
  /** Pasażerowie dziennie w jedną stronę. */
  passengers: number;
  load: number;
  /** Chętni, którzy nie zmieścili się do samolotu. */
  unmet: number;
  revenueWeekly: number;
  costWeekly: number;
  profitWeekly: number;
}

/** Wynik trasy przy podanej cenie i liczbie lotów. Bez raty leasingu, która jest kosztem floty. */
export function economics(index: WorldIndex, state: GameState, to: string, type: AircraftType, rotations: number, priceFactor: number, month: number): RouteEconomics {
  const base = need(index, state.baseIata);
  const dest = need(index, to);
  const d = demand(index, base, dest, month);
  const km = d.distanceKm;
  const price = typicalPrice(km) * priceFactor;
  const wanting = d.air * priceFactor ** -PRICE_ELASTICITY;
  const seats = type.seats * rotations;
  const passengers = Math.min(seats, wanting);
  const revenueWeekly = 2 * passengers * price * 7;
  const costWeekly = (type.fixedPerFlight + type.costPerKm * km) * rotations * 2 * 7;
  return {
    km,
    flightMin: flightMinutes(km, type),
    price,
    potential: d.air,
    wanting,
    seats,
    passengers,
    load: seats > 0 ? passengers / seats : 0,
    unmet: Math.max(0, wanting - seats),
    revenueWeekly,
    costWeekly,
    profitWeekly: revenueWeekly - costWeekly,
  };
}

export function planeOf(state: GameState, route: Route): Plane {
  const p = state.fleet.find((x) => x.reg === route.planeReg);
  if (!p) throw new Error(`trasa bez samolotu: ${route.to}`);
  return p;
}
export function routeEconomics(index: WorldIndex, state: GameState, route: Route, month: number): RouteEconomics {
  return economics(index, state, route.to, aircraftType(planeOf(state, route).typeId), route.rotations, route.priceFactor, month);
}

export const weeklyLease = (state: GameState): number => state.fleet.reduce((s, p) => s + aircraftType(p.typeId).leaseWeekly, 0);

export interface WeeklyResult {
  revenue: number;
  cost: number;
  lease: number;
  profit: number;
}
export function weeklyResult(index: WorldIndex, state: GameState, month: number): WeeklyResult {
  let revenue = 0;
  let cost = 0;
  for (const r of state.routes) {
    const e = routeEconomics(index, state, r, month);
    revenue += e.revenueWeekly;
    cost += e.costWeekly;
  }
  const lease = weeklyLease(state);
  return { revenue, cost, lease, profit: revenue - cost - lease };
}

/** Pieniądze płyną cały czas: wynik tygodnia rozłożony na minuty gry. */
export function advanceMoney(index: WorldIndex, state: GameState, month: number, minutes: number): GameState {
  if (minutes <= 0) return state;
  return { ...state, cash: state.cash + (weeklyResult(index, state, month).profit / 10_080) * minutes };
}

export type OpenCheck =
  | { ok: true; plane: Plane; type: AircraftType }
  | { ok: false; reason: 'is-base' | 'already-served' | 'no-free-plane' | 'too-far' | 'runway-too-short'; type?: AircraftType };

/** Czy da się teraz otworzyć trasę z bazy do podanego lotniska i którym samolotem. */
export function canOpenRoute(index: WorldIndex, state: GameState, to: string): OpenCheck {
  if (to === state.baseIata) return { ok: false, reason: 'is-base' };
  if (state.routes.some((r) => r.to === to)) return { ok: false, reason: 'already-served' };
  const free = state.fleet.filter((p) => !p.routeTo);
  if (!free.length) return { ok: false, reason: 'no-free-plane' };
  const km = routeKm(index, state, to);
  const dest = need(index, to);
  const inRange = free.filter((p) => aircraftType(p.typeId).rangeKm >= km);
  if (!inRange.length) return { ok: false, reason: 'too-far', type: aircraftType(free[0]!.typeId) };
  const fits = inRange.find((p) => !dest.runwayM || dest.runwayM >= aircraftType(p.typeId).runwayM);
  if (!fits) return { ok: false, reason: 'runway-too-short', type: aircraftType(inRange[0]!.typeId) };
  return { ok: true, plane: fits, type: aircraftType(fits.typeId) };
}

export function openRoute(index: WorldIndex, state: GameState, to: string): GameState {
  const check = canOpenRoute(index, state, to);
  if (!check.ok) return state;
  return {
    ...state,
    fleet: state.fleet.map((p) => (p.reg === check.plane.reg ? { ...p, routeTo: to } : p)),
    routes: [...state.routes, { to, rotations: 1, priceFactor: 1, planeReg: check.plane.reg }],
  };
}

export function closeRoute(state: GameState, to: string): GameState {
  const route = state.routes.find((r) => r.to === to);
  if (!route) return state;
  return {
    ...state,
    fleet: state.fleet.map((p) => (p.reg === route.planeReg ? { ...p, routeTo: null } : p)),
    routes: state.routes.filter((r) => r !== route),
  };
}

export function changePrice(state: GameState, to: string, delta: number): GameState {
  return {
    ...state,
    routes: state.routes.map((r) => (r.to === to ? { ...r, priceFactor: Math.min(PRICE_MAX, Math.max(PRICE_MIN, Number((r.priceFactor + delta).toFixed(2)))) } : r)),
  };
}

export function changeRotations(index: WorldIndex, state: GameState, to: string, delta: number): GameState {
  return {
    ...state,
    routes: state.routes.map((r) => {
      if (r.to !== to) return r;
      const max = maxRotations(routeKm(index, state, to), aircraftType(planeOf(state, r).typeId));
      return { ...r, rotations: Math.min(max, Math.max(1, r.rotations + delta)) };
    }),
  };
}

/** Bierze samolot w leasing. Trafia do bazy od razu i od razu kosztuje ratę. */
export function leasePlane(state: GameState, typeId: string): GameState {
  aircraftType(typeId);
  const prefix = `SP-${initials(state.airlineName)}`;
  let i = 0;
  let reg = '';
  do {
    reg = prefix + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');
    i++;
  } while (state.fleet.some((p) => p.reg === reg));
  return { ...state, fleet: [...state.fleet, { reg, typeId, routeTo: null }] };
}

/** Oddaje wolny samolot leasingodawcy. Samolotu przypisanego do trasy oddać się nie da. */
export function returnPlane(state: GameState, reg: string): GameState {
  const plane = state.fleet.find((p) => p.reg === reg);
  if (!plane || plane.routeTo || state.fleet.length <= 1) return state;
  return { ...state, fleet: state.fleet.filter((p) => p !== plane) };
}

export type FlightPhase =
  | { at: 'outbound' | 'inbound'; progress: number; landsMin: number }
  | { at: 'destination'; departsMin: number }
  | { at: 'base'; departsMin: number | null };

/**
 * Gdzie jest samolot trasy o danej minucie doby (czas lokalny bazy).
 * `slot` rozsuwa pierwsze odloty kolejnych tras, żeby nie startowały wszystkie naraz.
 */
export function flightPhase(route: Route, km: number, type: AircraftType, minuteOfDay: number, slot: number): FlightPhase {
  const fm = flightMinutes(km, type);
  const cycle = 2 * (fm + TURNAROUND_MIN);
  const first = FIRST_DEPARTURE_MIN + ((slot * 23) % 70);
  const sinceFirst = minuteOfDay - first;
  if (sinceFirst < 0) return { at: 'base', departsMin: first };
  const k = Math.floor(sinceFirst / cycle);
  if (k >= route.rotations) return { at: 'base', departsMin: null };
  const start = first + k * cycle;
  const p = sinceFirst - k * cycle;
  if (p < fm) return { at: 'outbound', progress: p / fm, landsMin: start + fm };
  if (p < fm + TURNAROUND_MIN) return { at: 'destination', departsMin: start + fm + TURNAROUND_MIN };
  if (p < 2 * fm + TURNAROUND_MIN) return { at: 'inbound', progress: (p - fm - TURNAROUND_MIN) / fm, landsMin: start + 2 * fm + TURNAROUND_MIN };
  return { at: 'base', departsMin: k + 1 < route.rotations ? start + cycle : null };
}
