/**
 * Linia lotnicza gracza: flota, trasy, marka i pieniądze.
 * Wszystkie funkcje są czyste: dostają stan gry i zwracają nowy, niczego nie zmieniając w miejscu.
 */
import { aircraftType, RESALE_SHARE, type AircraftType } from './aircraft';
import { demand, type WorldIndex } from './demand';
import { distanceKm } from './geo';
import type { Airport } from './world';

export interface Plane {
  /** Znak rejestracyjny, np. SP-SAA. */
  reg: string;
  typeId: string;
  /** Kod lotniska docelowego trasy, na której samolot lata; null, gdy stoi wolny w bazie. */
  routeTo: string | null;
  /** true = kupiony na własność (bez raty), false = w leasingu. */
  owned: boolean;
  /** Zlecenie, które samolot właśnie wykonuje; null, gdy żadnego. */
  job: Job | null;
}

/** Jednorazowe zlecenie: ładunek albo grupa do przewiezienia z bazy i powrót. */
export interface Offer {
  id: number;
  kind: 'cargo' | 'charter';
  /** Co albo kogo trzeba przewieźć. */
  what: string;
  to: string;
  /** Tony ładunku albo liczba pasażerów. */
  amount: number;
  /** Zapłata po wykonaniu, w złotych. */
  reward: number;
  /** Minuta gry, po której oferta znika. */
  expiresMin: number;
}

export interface Job {
  kind: Offer['kind'];
  what: string;
  to: string;
  reward: number;
  startMin: number;
  endMin: number;
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

export interface WeekReport {
  /** Numer zakończonego tygodnia, od 1. */
  week: number;
  profit: number;
  cash: number;
  best: { to: string; profit: number } | null;
  worst: { to: string; profit: number } | null;
}

export interface GameState {
  airlineName: string;
  baseIata: string;
  cash: number;
  /** Zadłużenie w banku. */
  loan: number;
  fleet: Plane[];
  routes: Route[];
  /** Znajomość marki w miastach (0–1), tylko tam, gdzie odbiega od wartości domyślnej. */
  awareness: Record<string, number>;
  /** Minuty gry od startu. */
  minutes: number;
  /** Raport z ostatniego zakończonego tygodnia, czekający na pokazanie graczowi. */
  report: WeekReport | null;
  bankrupt: boolean;
  /** Zlecenia czekające na przyjęcie. */
  offers: Offer[];
  /** Ziarno losowości: ta sama gra daje te same zlecenia. */
  seed: number;
  nextOfferId: number;
  /** Zarobek ze zleceń od początku bieżącego tygodnia. */
  jobIncomeWeek: number;
}

export const STARTING_CASH = 3_000_000;
export const TURNAROUND_MIN = 35;
export const WEEK_MIN = 10_080;
const DAY_MIN = 1440;
/** Pierwszy odlot z bazy: 6:00 czasu lokalnego. Samoloty pracują do późnego wieczora. */
const FIRST_DEPARTURE_MIN = 6 * 60;
const WORKING_DAY_MIN = 17 * 60;
const PRICE_MIN = 0.5;
const PRICE_MAX = 2;
/** Jak mocno liczba chętnych reaguje na cenę. */
const PRICE_ELASTICITY = 1.6;
/** Odsetki od kredytu za tydzień. */
export const LOAN_INTEREST_WEEKLY = 0.003;
/** Poniżej takiego stanu konta bank zamyka linię. */
export const BANKRUPTCY_LIMIT = -1_000_000;
/** Znajomość marki rośnie o tyle dziennie w mieście, do którego linia lata. */
const AWARENESS_PER_DAY = 0.2;
const CAMPAIGN_BOOST = 0.35;

/** Dwie litery do znaków rejestracyjnych, z nazwy linii. */
function initials(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/);
  const first = words[0] ?? 'X';
  const raw = (first[0] ?? 'X') + (words[1]?.[0] ?? first[1] ?? 'X');
  return raw.replace(/[^A-Z]/g, 'X');
}

export function newGame(baseIata: string, airlineName: string, seed = 20270216): GameState {
  return {
    offers: [],
    seed,
    nextOfferId: 1,
    jobIncomeWeek: 0,
    airlineName,
    baseIata,
    cash: STARTING_CASH,
    loan: 0,
    fleet: [{ reg: `SP-${initials(airlineName)}A`, typeId: 'AT76', routeTo: null, owned: false, job: null }],
    routes: [],
    awareness: {},
    minutes: 0,
    report: null,
    bankrupt: false,
  };
}

/** Typowa cena biletu w jedną stronę na danej odległości, w złotych. */
export const typicalPrice = (km: number): number => 120 + 0.16 * km;
export const flightMinutes = (km: number, type: AircraftType): number => (km / type.speedKmh) * 60 + 18;
/** Ile lotów tam i z powrotem samolot zmieści w ciągu dnia pracy. */
export function maxRotations(km: number, type: AircraftType): number {
  return Math.max(1, Math.min(6, Math.floor(WORKING_DAY_MIN / (2 * (flightMinutes(km, type) + TURNAROUND_MIN)))));
}

/** Wolny samolot: nie lata na trasie i nie wykonuje zlecenia. */
export const isFree = (p: Plane): boolean => !p.routeTo && !p.job;

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

// ---------------------------------------------------------------- marka

/** Znajomość marki w mieście (0–1). W bazie zna ją każdy, w pobliżu wielu, daleko prawie nikt. */
export function awarenessOf(index: WorldIndex, state: GameState, iata: string): number {
  if (iata === state.baseIata) return 1;
  const known = state.awareness[iata];
  if (known !== undefined) return known;
  return routeKm(index, state, iata) < 450 ? 0.5 : 0.12;
}

/** Koszt kampanii reklamowej w mieście: im więcej ludzi w zasięgu lotniska, tym drożej. */
export function campaignCost(index: WorldIndex, iata: string): number {
  return Math.round((25_000 + 9_000 * Math.min(20, need(index, iata).catchRaw / 1e6)) / 1000) * 1000;
}

export function runCampaign(index: WorldIndex, state: GameState, iata: string): GameState {
  const cost = campaignCost(index, iata);
  const now = awarenessOf(index, state, iata);
  if (iata === state.baseIata || now >= 0.99 || state.cash < cost) return state;
  return { ...state, cash: state.cash - cost, awareness: { ...state.awareness, [iata]: Math.min(1, now + CAMPAIGN_BOOST) } };
}

// ---------------------------------------------------------------- ekonomia trasy

export interface RouteEconomics {
  km: number;
  flightMin: number;
  price: number;
  /** Wszyscy chętni dziennie w jedną stronę przy typowej cenie (cały rynek). */
  market: number;
  /** Pasażerowie, których dziennie w jedną stronę przewożą już inne linie (z prawdziwych danych). */
  rivals: number;
  /** Jaka część rynku przypada graczowi przy obecnej ofercie (0–1). */
  share: number;
  /** Znajomość marki w mieście docelowym (0–1). */
  awareness: number;
  /** Chętni na lot z graczem, dziennie w jedną stronę, przy obecnej cenie. */
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

/** Prawdziwy ruch innych linii na trasie z bazy: pasażerowie dziennie w jedną stronę. */
export function rivalTraffic(index: WorldIndex, state: GameState, to: string): number {
  const key = state.baseIata < to ? `${state.baseIata}-${to}` : `${to}-${state.baseIata}`;
  return (index.realTraffic.get(key) ?? 0) / 730;
}

/**
 * Wynik trasy przy podanej cenie i liczbie lotów. Bez raty leasingu, która jest kosztem floty.
 *
 * Ilu ludzi poleci z graczem, zależy od trzech rzeczy:
 *   - ceny: drożej to mniej chętnych,
 *   - znajomości marki w mieście docelowym: nieznana linia zbiera tylko część rynku,
 *   - konkurencji: gdzie inne linie już latają, rynek dzieli się według liczby miejsc i ceny.
 */
export function economics(index: WorldIndex, state: GameState, to: string, type: AircraftType, rotations: number, priceFactor: number, month: number): RouteEconomics {
  const base = need(index, state.baseIata);
  const dest = need(index, to);
  const d = demand(index, base, dest, month);
  const km = d.distanceKm;
  const price = typicalPrice(km) * priceFactor;
  const seats = type.seats * rotations;
  const awareness = awarenessOf(index, state, to);
  const rivals = rivalTraffic(index, state, to);
  // Siła oferty: liczba miejsc, tańsze bilety przyciągają mocniej. Rywale latają po typowej cenie.
  const mine = seats * priceFactor ** -2;
  const split = rivals > 0 ? mine / (mine + rivals * 1.1) : 1;
  // Nowa linia zawsze przyciąga trochę nowych pasażerów, nawet na obsadzonym rynku.
  const share = rivals > 0 ? 0.35 + 0.65 * split : 1;
  const wanting = d.air * share * (0.35 + 0.65 * awareness) * priceFactor ** -PRICE_ELASTICITY;
  const passengers = Math.min(seats, wanting);
  const revenueWeekly = 2 * passengers * price * 7;
  const costWeekly = (type.fixedPerFlight + type.costPerKm * km) * rotations * 2 * 7;
  return {
    km,
    flightMin: flightMinutes(km, type),
    price,
    market: d.air,
    rivals,
    share,
    awareness,
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

// ---------------------------------------------------------------- pieniądze

export const weeklyLease = (state: GameState): number => state.fleet.reduce((s, p) => s + (p.owned ? 0 : aircraftType(p.typeId).leaseWeekly), 0);

export interface WeeklyResult {
  revenue: number;
  cost: number;
  lease: number;
  interest: number;
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
  const interest = state.loan * LOAN_INTEREST_WEEKLY;
  return { revenue, cost, lease, interest, profit: revenue - cost - lease - interest };
}

/** Ile bank pożyczy łącznie: stała kwota na start plus wielokrotność tygodniowej sprzedaży biletów. */
export function loanLimit(index: WorldIndex, state: GameState, month: number): number {
  return Math.round((2_000_000 + 6 * weeklyResult(index, state, month).revenue) / 100_000) * 100_000;
}
export function takeLoan(index: WorldIndex, state: GameState, month: number, amount: number): GameState {
  const a = Math.min(amount, loanLimit(index, state, month) - state.loan);
  return a > 0 ? { ...state, cash: state.cash + a, loan: state.loan + a } : state;
}
export function repayLoan(state: GameState, amount: number): GameState {
  const a = Math.min(amount, state.loan, Math.max(0, state.cash));
  return a > 0 ? { ...state, cash: state.cash - a, loan: state.loan - a } : state;
}

/** Poziomy rozwoju linii według tygodniowej sprzedaży biletów. */
export const LEVELS = [
  { name: 'Linia lokalna', revenue: 0 },
  { name: 'Linia regionalna', revenue: 400_000 },
  { name: 'Linia krajowa', revenue: 2_000_000 },
  { name: 'Linia europejska', revenue: 8_000_000 },
  { name: 'Linia światowa', revenue: 30_000_000 },
] as const;
export function levelOf(weeklyRevenue: number): { index: number; name: string; next: { name: string; revenue: number } | null } {
  let i = 0;
  while (i + 1 < LEVELS.length && weeklyRevenue >= LEVELS[i + 1]!.revenue) i++;
  return { index: i, name: LEVELS[i]!.name, next: LEVELS[i + 1] ?? null };
}

/**
 * Upływ czasu gry: pieniądze płyną co minutę, znajomość marki rośnie tam, gdzie linia lata,
 * a na koniec każdego tygodnia powstaje raport. Poniżej limitu zadłużenia linia bankrutuje.
 */
export function advanceGame(index: WorldIndex, state: GameState, month: number, minutes: number): GameState {
  if (minutes <= 0 || state.bankrupt) return state;
  let cash = state.cash + (weeklyResult(index, state, month).profit / WEEK_MIN) * minutes;
  const total = state.minutes + minutes;
  // Zlecenia: samolot wraca, zapłata wpływa na konto.
  let fleet = state.fleet;
  let jobIncomeWeek = state.jobIncomeWeek;
  if (fleet.some((p) => p.job && p.job.endMin <= total)) {
    fleet = fleet.map((p) => {
      if (!p.job || p.job.endMin > total) return p;
      cash += p.job.reward;
      jobIncomeWeek += p.job.reward;
      return { ...p, job: null };
    });
  }
  let offers = state.offers.filter((o) => o.expiresMin > total);
  let nextOfferId = state.nextOfferId;
  const day = Math.floor(total / DAY_MIN);
  if (day > Math.floor(state.minutes / DAY_MIN) || (state.minutes === 0 && !offers.length)) {
    const fresh = generateOffers(index, { ...state, fleet, offers }, day, total, nextOfferId);
    offers = [...offers, ...fresh];
    nextOfferId += fresh.length;
  }
  let awareness = state.awareness;
  for (const r of state.routes) {
    const now = awarenessOf(index, state, r.to);
    if (now < 1) {
      if (awareness === state.awareness) awareness = { ...awareness };
      awareness[r.to] = Math.min(1, now + (AWARENESS_PER_DAY * minutes) / DAY_MIN);
    }
  }
  let report = state.report;
  const week = Math.floor(total / WEEK_MIN);
  if (week > Math.floor(state.minutes / WEEK_MIN)) {
    const perRoute = state.routes.map((r) => ({ to: r.to, profit: routeEconomics(index, state, r, month).profitWeekly })).sort((x, y) => y.profit - x.profit);
    report = {
      week,
      profit: weeklyResult(index, state, month).profit + jobIncomeWeek,
      cash,
      best: perRoute[0] ?? null,
      worst: perRoute.length > 1 ? (perRoute[perRoute.length - 1] ?? null) : null,
    };
  }
  if (week > Math.floor(state.minutes / WEEK_MIN)) jobIncomeWeek = 0;
  return { ...state, cash, fleet, offers, nextOfferId, jobIncomeWeek, awareness, minutes: total, report, bankrupt: cash < BANKRUPTCY_LIMIT };
}

export const dismissReport = (state: GameState): GameState => (state.report ? { ...state, report: null } : state);

// ---------------------------------------------------------------- zlecenia: cargo i czartery

/** Ładowność samolotu w tonach, gdy leci jako frachtowiec. */
export const cargoTons = (type: AircraftType): number => Math.round(type.seats * 0.11);
/** Czas postoju u celu przy zleceniu: rozładunek albo oczekiwanie na grupę. */
const JOB_GROUND_MIN = 180;
const CARGO = ['części samochodowe', 'leki', 'elektronika', 'kwiaty cięte', 'przesyłki kurierskie', 'sprzęt medyczny', 'części lotnicze', 'ryby i owoce morza'];
const GROUPS = ['drużyna piłkarska', 'wycieczka firmowa', 'orkiestra', 'kibice', 'ekipa filmowa', 'uczestnicy targów'];

/** Prosty generator losowy z ziarnem: te same dane wejściowe dają zawsze te same zlecenia. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nowe zlecenia na dany dzień. Skala ofert rośnie razem z flotą gracza. */
function generateOffers(index: WorldIndex, state: GameState, day: number, nowMin: number, firstId: number): Offer[] {
  const MAX_OPEN = 4;
  if (state.offers.length >= MAX_OPEN) return [];
  const rand = rng(state.seed + day * 7919);
  const types = state.fleet.map((p) => aircraftType(p.typeId));
  const reachKm = Math.max(1500, ...types.map((t) => t.rangeKm)) * 1.1;
  const maxSeats = Math.max(...types.map((t) => t.seats));
  const base = need(index, state.baseIata);
  const candidates = [...index.airports.values()].filter((a) => {
    if (a === base || a.catchRaw < 300_000 || (a.runwayM && a.runwayM < 1300)) return false;
    const km = distanceKm([base.lng, base.lat], [a.lng, a.lat]);
    return km > 150 && km < reachKm;
  });
  if (!candidates.length) return [];
  const out: Offer[] = [];
  const count = Math.min(MAX_OPEN - state.offers.length, 1 + Math.floor(rand() * 2));
  for (let i = 0; i < count; i++) {
    const to = candidates[Math.floor(rand() * candidates.length)]!;
    const km = distanceKm([base.lng, base.lat], [to.lng, to.lat]);
    const kind: Offer['kind'] = rand() < 0.6 ? 'cargo' : 'charter';
    // Czasem oferta jest trochę za duża na obecną flotę: zachęta, żeby rosnąć.
    const refSeats = Math.max(20, Math.round(maxSeats * (0.25 + rand() * 0.95)));
    const amount = kind === 'cargo' ? Math.max(1, Math.round(refSeats * 0.11)) : refSeats;
    const flightCost = 2 * (1500 + 35 * refSeats + (4 + 0.117 * refSeats) * km);
    out.push({
      id: firstId + i,
      kind,
      what: kind === 'cargo' ? CARGO[Math.floor(rand() * CARGO.length)]! : GROUPS[Math.floor(rand() * GROUPS.length)]!,
      to: to.iata,
      amount,
      reward: Math.round((flightCost * (1.5 + rand() * 0.9)) / 1000) * 1000,
      expiresMin: nowMin + DAY_MIN * (1 + Math.floor(rand() * 2)),
    });
  }
  return out;
}

export type OfferCheck =
  | { ok: true; plane: Plane; type: AircraftType; cost: number; durationMin: number }
  | { ok: false; reason: 'no-free-plane' | 'too-small' | 'too-far' | 'runway-too-short' };

/** Czy któryś wolny samolot może wykonać zlecenie i ile będzie kosztował sam lot. */
export function canAcceptOffer(index: WorldIndex, state: GameState, offer: Offer): OfferCheck {
  const free = state.fleet.filter(isFree).map((plane) => ({ plane, type: aircraftType(plane.typeId) }));
  if (!free.length) return { ok: false, reason: 'no-free-plane' };
  const big = free.filter(({ type }) => (offer.kind === 'cargo' ? cargoTons(type) : type.seats) >= offer.amount);
  if (!big.length) return { ok: false, reason: 'too-small' };
  const km = routeKm(index, state, offer.to);
  const reach = big.filter(({ type }) => type.rangeKm >= km);
  if (!reach.length) return { ok: false, reason: 'too-far' };
  const dest = need(index, offer.to);
  // Najmniejszy samolot, który podoła: tańszy lot i większe maszyny zostają wolne.
  const fit = reach.filter(({ type }) => !dest.runwayM || dest.runwayM >= type.runwayM).sort((x, y) => x.type.seats - y.type.seats)[0];
  if (!fit) return { ok: false, reason: 'runway-too-short' };
  return {
    ok: true,
    plane: fit.plane,
    type: fit.type,
    cost: 2 * (fit.type.fixedPerFlight + fit.type.costPerKm * km),
    durationMin: 2 * flightMinutes(km, fit.type) + JOB_GROUND_MIN,
  };
}

/** Przyjmuje zlecenie: koszt lotu schodzi od razu, samolot odlatuje, zapłata wpływa po powrocie. */
export function acceptOffer(index: WorldIndex, state: GameState, offerId: number): GameState {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return state;
  const check = canAcceptOffer(index, state, offer);
  if (!check.ok) return state;
  const job: Job = { kind: offer.kind, what: offer.what, to: offer.to, reward: offer.reward, startMin: state.minutes, endMin: state.minutes + check.durationMin };
  return {
    ...state,
    cash: state.cash - check.cost,
    offers: state.offers.filter((o) => o !== offer),
    fleet: state.fleet.map((p) => (p.reg === check.plane.reg ? { ...p, job } : p)),
  };
}

/** Gdzie jest samolot wykonujący zlecenie: w drodze tam, u celu, w drodze powrotnej. */
export function jobPhase(job: Job, minutes: number): { at: 'outbound' | 'inbound'; progress: number } | { at: 'destination' } {
  const leg = (job.endMin - job.startMin - JOB_GROUND_MIN) / 2;
  const t = minutes - job.startMin;
  if (t < leg) return { at: 'outbound', progress: Math.max(0, t / leg) };
  if (t < leg + JOB_GROUND_MIN) return { at: 'destination' };
  return { at: 'inbound', progress: Math.min(1, (t - leg - JOB_GROUND_MIN) / leg) };
}

// ---------------------------------------------------------------- trasy

export type OpenCheck =
  | { ok: true; plane: Plane; type: AircraftType }
  | { ok: false; reason: 'is-base' | 'already-served' | 'no-free-plane' | 'too-far' | 'runway-too-short'; type?: AircraftType };

/** Czy da się teraz otworzyć trasę z bazy do podanego lotniska i którym samolotem. */
export function canOpenRoute(index: WorldIndex, state: GameState, to: string): OpenCheck {
  if (to === state.baseIata) return { ok: false, reason: 'is-base' };
  if (state.routes.some((r) => r.to === to)) return { ok: false, reason: 'already-served' };
  const free = state.fleet.filter(isFree);
  if (!free.length) return { ok: false, reason: 'no-free-plane' };
  const km = routeKm(index, state, to);
  const dest = need(index, to);
  const inRange = free.filter((p) => aircraftType(p.typeId).rangeKm >= km);
  if (!inRange.length) return { ok: false, reason: 'too-far', type: aircraftType(free[0]!.typeId) };
  // Spośród samolotów, które dolecą i wylądują, bierzemy najmniejszy: większe przydadzą się na mocniejszych trasach.
  const fits = inRange.filter((p) => !dest.runwayM || dest.runwayM >= aircraftType(p.typeId).runwayM).sort((x, y) => aircraftType(x.typeId).seats - aircraftType(y.typeId).seats)[0];
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

/** Przesiada trasę na inny, wolny samolot (np. większy). Dotychczasowy wraca do bazy. */
export function swapPlane(index: WorldIndex, state: GameState, to: string, reg: string): GameState {
  const route = state.routes.find((r) => r.to === to);
  const plane = state.fleet.find((p) => p.reg === reg);
  if (!route || !plane || !isFree(plane)) return state;
  const type = aircraftType(plane.typeId);
  const km = routeKm(index, state, to);
  const dest = need(index, to);
  if (type.rangeKm < km || (dest.runwayM && dest.runwayM < type.runwayM)) return state;
  return {
    ...state,
    fleet: state.fleet.map((p) => (p.reg === reg ? { ...p, routeTo: to } : p.reg === route.planeReg ? { ...p, routeTo: null } : p)),
    routes: state.routes.map((r) => (r === route ? { ...r, planeReg: reg, rotations: Math.min(r.rotations, maxRotations(km, type)) } : r)),
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

// ---------------------------------------------------------------- flota

function nextReg(state: GameState): string {
  const prefix = `SP-${initials(state.airlineName)}`;
  for (let i = 0; ; i++) {
    const reg = prefix + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');
    if (!state.fleet.some((p) => p.reg === reg)) return reg;
  }
}

/** Bierze samolot w leasing. Trafia do bazy od razu i od razu kosztuje ratę. */
export function leasePlane(state: GameState, typeId: string): GameState {
  aircraftType(typeId);
  return { ...state, fleet: [...state.fleet, { reg: nextReg(state), typeId, routeTo: null, owned: false, job: null }] };
}

/** Kupuje samolot na własność: jednorazowy wydatek, bez raty. */
export function buyPlane(state: GameState, typeId: string): GameState {
  const type = aircraftType(typeId);
  if (state.cash < type.price) return state;
  return { ...state, cash: state.cash - type.price, fleet: [...state.fleet, { reg: nextReg(state), typeId, routeTo: null, owned: true, job: null }] };
}

/** Oddaje wolny samolot z leasingu albo sprzedaje własny. Samolotu przypisanego do trasy ruszyć się nie da. */
export function returnPlane(state: GameState, reg: string): GameState {
  const plane = state.fleet.find((p) => p.reg === reg);
  if (!plane || !isFree(plane) || state.fleet.length <= 1) return state;
  const refund = plane.owned ? aircraftType(plane.typeId).price * RESALE_SHARE : 0;
  return { ...state, cash: state.cash + refund, fleet: state.fleet.filter((p) => p !== plane) };
}

// ---------------------------------------------------------------- rozkład

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
