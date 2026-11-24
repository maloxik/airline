import { describe, expect, it } from 'vitest';
import realJson from '../../public/data/real-routes.json';
import worldJson from '../../public/data/world.json';
import {
  acceptOffer,
  advanceGame,
  AIRCRAFT,
  aircraftType,
  awarenessOf,
  BANKRUPTCY_LIMIT,
  buyPlane,
  campaignCost,
  canAcceptOffer,
  canOpenRoute,
  cargoTons,
  changePrice,
  changeRotations,
  closeRoute,
  dismissReport,
  economics,
  flightPhase,
  indexWorld,
  jobPhase,
  leasePlane,
  levelOf,
  loanLimit,
  maxRotations,
  newGame,
  openRoute,
  repayLoan,
  returnPlane,
  routeEconomics,
  routeKm,
  runCampaign,
  STARTING_CASH,
  swapPlane,
  takeLoan,
  WEEK_MIN,
  weeklyResult,
  type GameState,
  type RealRoutes,
  type WorldData,
} from './index';

const index = indexWorld(worldJson as unknown as WorldData, realJson as unknown as RealRoutes);
const start = (): GameState => newGame('KTW', 'Silesia Air');
const atr = aircraftType('AT76');

describe('katalog samolotów', () => {
  it('ma cztery klasy i spójne liczby', () => {
    expect(AIRCRAFT.length).toBeGreaterThan(18);
    for (const cls of ['tp', 'rj', 'nb', 'wb']) expect(AIRCRAFT.some((t) => t.cls === cls)).toBe(true);
    for (const t of AIRCRAFT) {
      expect(t.price).toBeGreaterThan(t.leaseWeekly * 100);
      expect(t.fixedPerFlight).toBeGreaterThan(0);
    }
    expect(aircraftType('A359').leaseWeekly).toBeGreaterThan(aircraftType('A20N').leaseWeekly);
    expect(aircraftType('A20N').costPerKm).toBeLessThan(aircraftType('A320').costPerKm);
  });
});

describe('start gry', () => {
  it('daje jeden wolny samolot w leasingu, pieniądze i żadnych tras', () => {
    const g = start();
    expect(g.cash).toBe(STARTING_CASH);
    expect(g.fleet).toEqual([{ reg: 'SP-SAA', typeId: 'AT76', routeTo: null, owned: false, job: null }]);
    expect(g.routes).toHaveLength(0);
    expect(g.loan).toBe(0);
  });
});

describe('trasy', () => {
  it('otwarcie trasy zajmuje wolny samolot, zamknięcie go zwalnia', () => {
    const g1 = openRoute(index, start(), 'WAW');
    expect(g1.routes).toHaveLength(1);
    expect(g1.fleet[0]!.routeTo).toBe('WAW');
    expect(canOpenRoute(index, g1, 'GDN')).toEqual({ ok: false, reason: 'no-free-plane' });
    expect(canOpenRoute(index, g1, 'WAW')).toMatchObject({ ok: false, reason: 'already-served' });
    const g2 = closeRoute(g1, 'WAW');
    expect(g2.routes).toHaveLength(0);
    expect(g2.fleet[0]!.routeTo).toBeNull();
  });

  it('turbośmigłowiec nie doleci do Nowego Jorku, a baza nie jest celem', () => {
    expect(canOpenRoute(index, start(), 'JFK')).toMatchObject({ ok: false, reason: 'too-far' });
    expect(canOpenRoute(index, start(), 'KTW')).toMatchObject({ ok: false, reason: 'is-base' });
    expect(openRoute(index, start(), 'JFK').routes).toHaveLength(0);
  });

  it('funkcje nie zmieniają stanu w miejscu', () => {
    const g = start();
    openRoute(index, g, 'WAW');
    expect(g.routes).toHaveLength(0);
    expect(g.fleet[0]!.routeTo).toBeNull();
  });

  it('trasę można przesiąść na większy wolny samolot', () => {
    let g = openRoute(index, start(), 'GDN');
    g = leasePlane(g, 'A20N');
    const big = g.fleet.find((p) => p.typeId === 'A20N')!;
    g = swapPlane(index, g, 'GDN', big.reg);
    expect(g.routes[0]!.planeReg).toBe(big.reg);
    expect(g.fleet.find((p) => p.typeId === 'AT76')!.routeTo).toBeNull();
    expect(routeEconomics(index, g, g.routes[0]!, 3).seats).toBe(180);
  });
});

describe('ekonomia trasy', () => {
  it('wyższa cena to mniej chętnych, a pełny samolot nie zabierze więcej niż ma miejsc', () => {
    const g = start();
    const cheap = economics(index, g, 'GDN', atr, 1, 0.7, 3);
    const dear = economics(index, g, 'GDN', atr, 1, 1.6, 3);
    expect(cheap.wanting).toBeGreaterThan(dear.wanting);
    expect(cheap.passengers).toBeLessThanOrEqual(atr.seats);
    expect(cheap.load).toBeLessThanOrEqual(1);
    expect(dear.price).toBeGreaterThan(cheap.price);
  });

  it('więcej lotów to więcej miejsc i wyższe koszty', () => {
    const g = start();
    const one = economics(index, g, 'GDN', atr, 1, 1, 3);
    const two = economics(index, g, 'GDN', atr, 2, 1, 3);
    expect(two.seats).toBe(2 * one.seats);
    expect(two.costWeekly).toBeCloseTo(2 * one.costWeekly, 6);
  });

  it('liczba lotów jest ograniczona czasem lotu, cena widełkami', () => {
    let g = openRoute(index, start(), 'GDN');
    const max = maxRotations(routeKm(index, g, 'GDN'), atr);
    for (let i = 0; i < 10; i++) g = changeRotations(index, g, 'GDN', 1);
    expect(g.routes[0]!.rotations).toBe(max);
    for (let i = 0; i < 10; i++) g = changeRotations(index, g, 'GDN', -1);
    expect(g.routes[0]!.rotations).toBe(1);
    for (let i = 0; i < 40; i++) g = changePrice(g, 'GDN', 0.05);
    expect(g.routes[0]!.priceFactor).toBe(2);
    for (let i = 0; i < 60; i++) g = changePrice(g, 'GDN', -0.05);
    expect(g.routes[0]!.priceFactor).toBe(0.5);
  });
});

describe('konkurencja', () => {
  it('na trasie, którą naprawdę ktoś lata, gracz dostaje tylko część rynku', () => {
    const g = start();
    const contested = economics(index, g, 'DTM', atr, 1, 1, 3);
    expect(contested.rivals).toBeGreaterThan(300);
    expect(contested.share).toBeGreaterThan(0.35);
    expect(contested.share).toBeLessThan(0.6);
  });

  it('więcej miejsc i niższa cena zwiększają udział w rynku', () => {
    const g = start();
    const small = economics(index, g, 'DTM', atr, 1, 1, 3);
    const more = economics(index, g, 'DTM', atr, 3, 1, 3);
    const cheaper = economics(index, g, 'DTM', atr, 1, 0.7, 3);
    expect(more.share).toBeGreaterThan(small.share);
    expect(cheaper.share).toBeGreaterThan(small.share);
  });

  it('gdzie nikt nie lata, cały rynek jest dla gracza', () => {
    const g = start();
    const free = [...index.airports.values()].find((a) => a.iata !== 'KTW' && economics(index, g, a.iata, atr, 1, 1, 3).rivals === 0)!;
    expect(economics(index, g, free.iata, atr, 1, 1, 3).share).toBe(1);
  });
});

describe('marka', () => {
  it('w bazie linię zna każdy, daleko prawie nikt, a nieznana linia zbiera mniej pasażerów', () => {
    const g = start();
    expect(awarenessOf(index, g, 'KTW')).toBe(1);
    expect(awarenessOf(index, g, 'WAW')).toBeGreaterThan(awarenessOf(index, g, 'BCN'));
    const unknown = economics(index, g, 'BCN', aircraftType('A20N'), 1, 1, 6);
    const known = economics(index, { ...g, awareness: { BCN: 1 } }, 'BCN', aircraftType('A20N'), 1, 1, 6);
    expect(known.wanting).toBeGreaterThan(unknown.wanting * 1.5);
  });

  it('kampania kosztuje i podnosi znajomość, a latanie podnosi ją z czasem', () => {
    const g = start();
    const after = runCampaign(index, g, 'AMS');
    expect(after.cash).toBe(g.cash - campaignCost(index, 'AMS'));
    expect(awarenessOf(index, after, 'AMS')).toBeGreaterThan(awarenessOf(index, g, 'AMS') + 0.3);
    expect(runCampaign(index, g, 'KTW')).toBe(g);
    const flying = advanceGame(index, openRoute(index, g, 'AMS'), 3, 1440 * 2);
    expect(awarenessOf(index, flying, 'AMS')).toBeGreaterThan(awarenessOf(index, g, 'AMS') + 0.3);
  });
});

describe('pieniądze', () => {
  it('wolny samolot w leasingu kosztuje ratę, więc bez tras konto maleje', () => {
    const g = { ...start(), offers: [], seed: 1 };
    const week = weeklyResult(index, g, 3);
    expect(week.revenue).toBe(0);
    expect(week.profit).toBe(-week.lease);
    const later = advanceGame(index, g, 3, 600);
    expect(later.cash).toBeCloseTo(g.cash - (week.lease * 600) / WEEK_MIN, 3);
  });

  it('kupiony samolot nie ma raty, a przy sprzedaży wraca część ceny', () => {
    const rich = { ...start(), cash: 50_000_000 };
    const g = buyPlane(rich, 'AT76');
    expect(g.cash).toBe(rich.cash - atr.price);
    expect(weeklyResult(index, g, 3).lease).toBe(atr.leaseWeekly);
    const owned = g.fleet.find((p) => p.owned)!;
    expect(returnPlane(g, owned.reg).cash).toBeCloseTo(g.cash + atr.price * 0.6, 3);
    expect(buyPlane(start(), 'A359').fleet).toHaveLength(1);
  });

  it('kredyt ma limit i odsetki, można go spłacić', () => {
    const g = start();
    const limit = loanLimit(index, g, 3);
    const borrowed = takeLoan(index, g, 3, 10 * limit);
    expect(borrowed.loan).toBe(limit);
    expect(borrowed.cash).toBe(g.cash + limit);
    expect(weeklyResult(index, borrowed, 3).interest).toBeGreaterThan(0);
    expect(repayLoan(borrowed, limit).loan).toBe(0);
  });

  it('koniec tygodnia daje raport, a duży dług kończy grę', () => {
    const g = openRoute(index, start(), 'GDN');
    const after = advanceGame(index, g, 3, WEEK_MIN + 1);
    expect(after.report?.week).toBe(1);
    expect(after.report?.best?.to).toBe('GDN');
    expect(dismissReport(after).report).toBeNull();
    const broke = advanceGame(index, { ...start(), cash: BANKRUPTCY_LIMIT + 10 }, 3, 1440);
    expect(broke.bankrupt).toBe(true);
    expect(advanceGame(index, broke, 3, 1440)).toBe(broke);
  });

  it('poziom linii rośnie ze sprzedażą', () => {
    expect(levelOf(0).name).toBe('Linia lokalna');
    expect(levelOf(500_000).index).toBe(1);
    expect(levelOf(1e9).next).toBeNull();
  });
});

describe('flota', () => {
  it('leasing dodaje samolot z kolejnym znakiem, oddać można tylko wolny i nie ostatni', () => {
    let g = leasePlane(start(), 'A20N');
    expect(g.fleet.map((p) => p.reg)).toEqual(['SP-SAA', 'SP-SAB']);
    g = openRoute(index, g, 'GDN');
    const busy = g.fleet.find((p) => p.routeTo)!;
    expect(returnPlane(g, busy.reg).fleet).toHaveLength(2);
    const free = g.fleet.find((p) => !p.routeTo)!;
    expect(returnPlane(g, free.reg).fleet).toHaveLength(1);
    expect(returnPlane(start(), 'SP-SAA').fleet).toHaveLength(1);
  });

  it('nową trasę dostaje najmniejszy samolot, który podoła', () => {
    const g = leasePlane(leasePlane(start(), 'A20N'), 'E175');
    const check = canOpenRoute(index, g, 'GDN');
    expect(check.ok && check.type.id).toBe('AT76');
    const far = canOpenRoute(index, g, 'LIS');
    expect(far.ok && far.type.id).toBe('E175');
  });
});

describe('zlecenia', () => {
  it('pojawiają się same, są powtarzalne dla tego samego ziarna i znikają po terminie', () => {
    const a = advanceGame(index, start(), 3, 10);
    const b = advanceGame(index, start(), 3, 10);
    expect(a.offers.length).toBeGreaterThan(0);
    expect(a.offers).toEqual(b.offers);
    const other = advanceGame(index, newGame('KTW', 'Silesia Air', 99), 3, 10);
    expect(other.offers).not.toEqual(a.offers);
    const late = advanceGame(index, { ...a, seed: 0, offers: a.offers.map((o) => ({ ...o, expiresMin: 20 })) }, 3, 30);
    expect(late.offers.every((o) => o.expiresMin > 40)).toBe(true);
  });

  it('przyjęte zlecenie zajmuje samolot, kosztuje lot i płaci po powrocie', () => {
    const g = { ...start(), offers: [{ id: 1, kind: 'cargo' as const, what: 'leki', to: 'WAW', amount: cargoTons(atr), reward: 90_000, expiresMin: 5000 }] };
    const check = canAcceptOffer(index, g, g.offers[0]!);
    if (!check.ok) throw new Error('zlecenie powinno być wykonalne');
    const flying = acceptOffer(index, g, 1);
    expect(flying.offers).toHaveLength(0);
    expect(flying.cash).toBeCloseTo(g.cash - check.cost, 3);
    expect(flying.fleet[0]!.job?.to).toBe('WAW');
    expect(canOpenRoute(index, flying, 'GDN')).toEqual({ ok: false, reason: 'no-free-plane' });
    expect(jobPhase(flying.fleet[0]!.job!, flying.minutes + 5).at).toBe('outbound');
    const done = advanceGame(index, { ...flying, seed: 0 }, 3, check.durationMin + 1);
    expect(done.fleet[0]!.job).toBeNull();
    expect(done.cash).toBeGreaterThan(flying.cash + 80_000);
  });

  it('za duży ładunek albo za daleki cel wymaga większego samolotu', () => {
    const g = start();
    const heavy = { id: 1, kind: 'cargo' as const, what: 'części', to: 'WAW', amount: 30, reward: 1, expiresMin: 9999 };
    const far = { id: 2, kind: 'charter' as const, what: 'kibice', to: 'LIS', amount: 40, reward: 1, expiresMin: 9999 };
    expect(canAcceptOffer(index, g, heavy)).toEqual({ ok: false, reason: 'too-small' });
    expect(canAcceptOffer(index, g, far)).toEqual({ ok: false, reason: 'too-far' });
    expect(canAcceptOffer(index, leasePlane(g, 'B789'), heavy).ok).toBe(true);
  });
});

describe('rozkład', () => {
  it('samolot przechodzi kolejno: baza, lot, cel, powrót, baza', () => {
    const g = openRoute(index, start(), 'WAW');
    const r = g.routes[0]!;
    const km = routeKm(index, g, 'WAW');
    expect(flightPhase(r, km, atr, 5 * 60, 0)).toEqual({ at: 'base', departsMin: 360 });
    expect(flightPhase(r, km, atr, 6 * 60 + 10, 0).at).toBe('outbound');
    expect(flightPhase(r, km, atr, 6 * 60 + 60, 0).at).toBe('destination');
    expect(flightPhase(r, km, atr, 6 * 60 + 100, 0).at).toBe('inbound');
    expect(flightPhase(r, km, atr, 23 * 60, 0)).toEqual({ at: 'base', departsMin: null });
  });
});
