import { describe, expect, it } from 'vitest';
import {
  advance,
  dayOfYear,
  distanceKm,
  greatCircle,
  mapBearing,
  nightPolygon,
  solarDeclination,
  sunAltitude,
  utcHours,
  type GameClock,
  type LngLat,
} from './index';

const KTW: LngLat = [19.08, 50.474];
const WAW: LngLat = [20.967, 52.166];
const LTN: LngLat = [-0.368, 51.875];

describe('geografia', () => {
  it('liczy znane odległości', () => {
    expect(distanceKm(KTW, WAW)).toBeGreaterThan(225);
    expect(distanceKm(KTW, WAW)).toBeLessThan(235);
    expect(distanceKm(KTW, LTN)).toBeGreaterThan(1340);
    expect(distanceKm(KTW, LTN)).toBeLessThan(1380);
    expect(distanceKm(KTW, KTW)).toBe(0);
  });

  it('łuk zaczyna się i kończy w zadanych punktach, a jego długość zgadza się z odległością', () => {
    const arc = greatCircle(KTW, LTN, 64);
    expect(arc).toHaveLength(65);
    expect(arc[0]![0]).toBeCloseTo(KTW[0], 6);
    expect(arc[64]![1]).toBeCloseTo(LTN[1], 6);
    let sum = 0;
    for (let i = 1; i < arc.length; i++) sum += distanceKm(arc[i - 1]!, arc[i]!);
    expect(sum).toBeCloseTo(distanceKm(KTW, LTN), 0);
  });

  it('łuk na zachód wygina się na północ od prostej', () => {
    const mid = greatCircle(KTW, LTN, 2)[1]!;
    expect(mid[1]).toBeGreaterThan((KTW[1] + LTN[1]) / 2);
  });

  it('kierunek na mapie', () => {
    expect(mapBearing(KTW, [KTW[0], KTW[1] + 1])).toBeCloseTo(0, 5);
    expect(mapBearing(KTW, [KTW[0] + 1, KTW[1]])).toBeCloseTo(90, 5);
    expect(mapBearing(KTW, WAW)).toBeGreaterThan(20);
    expect(mapBearing(KTW, WAW)).toBeLessThan(45);
  });
});

describe('słońce', () => {
  it('deklinacja: przesilenia i równonoce', () => {
    expect(solarDeclination(172)).toBeCloseTo(23.44, 0);
    expect(solarDeclination(355)).toBeCloseTo(-23.44, 0);
    expect(Math.abs(solarDeclination(80))).toBeLessThan(1.5);
  });

  it('w połowie lutego w Katowicach: noc o 3:00 UTC, dzień w południe', () => {
    const decl = solarDeclination(47);
    expect(sunAltitude(3, decl, KTW)).toBeLessThan(-20);
    expect(sunAltitude(11, decl, KTW)).toBeGreaterThan(20);
    // wschód około 5:50 UTC (6:50 czasu polskiego)
    expect(sunAltitude(5.5, decl, KTW)).toBeLessThan(0);
    expect(sunAltitude(6.3, decl, KTW)).toBeGreaterThan(0);
  });

  it('wielokąt nocy zawiera miejsca, gdzie jest ciemno, i jest domknięty', () => {
    const decl = solarDeclination(47);
    const poly = nightPolygon(3, decl, 0);
    expect(poly[0]).toEqual(poly[poly.length - 1]);
    const inside = (p: LngLat): boolean => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]!;
        const b = poly[j]!;
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
      }
      return hit;
    };
    expect(inside(KTW)).toBe(true);
    const noon = nightPolygon(11, decl, 0);
    const insideNoon = (p: LngLat): boolean => {
      let hit = false;
      for (let i = 0, j = noon.length - 1; i < noon.length; j = i++) {
        const a = noon[i]!;
        const b = noon[j]!;
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
      }
      return hit;
    };
    expect(insideNoon(KTW)).toBe(false);
  });
});

describe('zegar gry', () => {
  it('doba gry trwa zadany czas rzeczywisty', () => {
    const clock: GameClock = { startIso: '2027-02-16T04:05:00Z', minutes: 0 };
    expect(utcHours(clock)).toBeCloseTo(4 + 5 / 60, 6);
    expect(dayOfYear(clock)).toBe(47);
    advance(clock, 90_000, 1);
    expect(clock.minutes).toBeCloseTo(1440, 6);
    expect(dayOfYear(clock)).toBe(48);
    advance(clock, 45_000, 4);
    expect(clock.minutes).toBeCloseTo(1440 * 3, 6);
  });
});
