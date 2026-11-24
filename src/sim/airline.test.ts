import { describe, expect, it } from 'vitest';
import worldJson from '../../public/data/world.json';
import {
  advanceMoney,
  aircraftType,
  canOpenRoute,
  changePrice,
  changeRotations,
  closeRoute,
  economics,
  flightPhase,
  indexWorld,
  leasePlane,
  maxRotations,
  newGame,
  openRoute,
  returnPlane,
  routeEconomics,
  routeKm,
  STARTING_CASH,
  weeklyResult,
  type WorldData,
} from './index';

const index = indexWorld(worldJson as unknown as WorldData);
const start = () => newGame('KTW', 'Silesia Air');

describe('start gry', () => {
  it('daje jeden wolny samolot, pieniądze i żadnych tras', () => {
    const g = start();
    expect(g.cash).toBe(STARTING_CASH);
    expect(g.fleet).toEqual([{ reg: 'SP-SAA', typeId: 'AT76', routeTo: null }]);
    expect(g.routes).toHaveLength(0);
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
});

describe('ekonomia trasy', () => {
  it('wyższa cena to mniej chętnych, a pełny samolot nie zabierze więcej niż ma miejsc', () => {
    const g = start();
    const atr = aircraftType('AT76');
    const cheap = economics(index, g, 'GDN', atr, 1, 0.7, 3);
    const dear = economics(index, g, 'GDN', atr, 1, 1.6, 3);
    expect(cheap.wanting).toBeGreaterThan(dear.wanting);
    expect(cheap.passengers).toBeLessThanOrEqual(atr.seats);
    expect(cheap.load).toBeLessThanOrEqual(1);
    expect(dear.price).toBeGreaterThan(cheap.price);
  });

  it('więcej lotów to więcej miejsc i wyższe koszty', () => {
    const g = start();
    const atr = aircraftType('AT76');
    const one = economics(index, g, 'GDN', atr, 1, 1, 3);
    const two = economics(index, g, 'GDN', atr, 2, 1, 3);
    expect(two.seats).toBe(2 * one.seats);
    expect(two.costWeekly).toBeCloseTo(2 * one.costWeekly, 6);
  });

  it('liczba lotów jest ograniczona czasem lotu, cena widełkami', () => {
    let g = openRoute(index, start(), 'GDN');
    const max = maxRotations(routeKm(index, g, 'GDN'), aircraftType('AT76'));
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

describe('pieniądze', () => {
  it('wolny samolot kosztuje ratę, więc bez tras konto maleje', () => {
    const g = start();
    const week = weeklyResult(index, g, 3);
    expect(week.revenue).toBe(0);
    expect(week.profit).toBe(-week.lease);
    const later = advanceMoney(index, g, 3, 10_080);
    expect(later.cash).toBeCloseTo(g.cash - week.lease, 3);
  });

  it('wynik tygodnia to suma tras minus leasing', () => {
    const g = openRoute(index, leasePlane(start(), 'AT76'), 'GDN');
    const e = routeEconomics(index, g, g.routes[0]!, 3);
    const week = weeklyResult(index, g, 3);
    expect(week.profit).toBeCloseTo(e.profitWeekly - week.lease, 6);
    expect(week.lease).toBe(2 * aircraftType('AT76').leaseWeekly);
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
});

describe('rozkład', () => {
  it('samolot przechodzi kolejno: baza, lot, cel, powrót, baza', () => {
    const g = openRoute(index, start(), 'WAW');
    const r = g.routes[0]!;
    const km = routeKm(index, g, 'WAW');
    const atr = aircraftType('AT76');
    expect(flightPhase(r, km, atr, 5 * 60, 0)).toEqual({ at: 'base', departsMin: 360 });
    expect(flightPhase(r, km, atr, 6 * 60 + 10, 0).at).toBe('outbound');
    expect(flightPhase(r, km, atr, 6 * 60 + 60, 0).at).toBe('destination');
    expect(flightPhase(r, km, atr, 6 * 60 + 100, 0).at).toBe('inbound');
    expect(flightPhase(r, km, atr, 23 * 60, 0)).toEqual({ at: 'base', departsMin: null });
    const mid = flightPhase(r, km, atr, 6 * 60 + 10, 0);
    if (mid.at === 'outbound') {
      expect(mid.progress).toBeGreaterThan(0);
      expect(mid.progress).toBeLessThan(1);
    }
  });
});
