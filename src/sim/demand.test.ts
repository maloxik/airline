import { describe, expect, it } from 'vitest';
import worldJson from '../../public/data/world.json';
import { demand, indexWorld, landShare, yearlyAverageDemand, type Airport, type WorldData } from './index';

const world = worldJson as unknown as WorldData;
const index = indexWorld(world);
const ap = (iata: string): Airport => {
  const a = index.airports.get(iata);
  if (!a) throw new Error(`brak lotniska ${iata}`);
  return a;
};

describe('dane świata', () => {
  it('lotniska mają ludność, zamożność i dwanaście miesięcy noclegów', () => {
    expect(world.airports.length).toBeGreaterThan(500);
    for (const a of world.airports) {
      expect(a.nights).toHaveLength(12);
      expect(a.wealth).toBeGreaterThan(0);
      expect(a.catch).toBeLessThanOrEqual(a.catchRaw + 1);
    }
    expect(ap('KTW').catchRaw).toBeGreaterThan(3_500_000);
    expect(ap('KTW').catch).toBeGreaterThan(ap('RZE').catch);
  });

  it('Split żyje z lata: w lipcu wielokrotnie więcej noclegów niż w styczniu', () => {
    const spu = ap('SPU');
    expect(spu.nightsEstimated).toBe(false);
    expect(spu.nights[6]!).toBeGreaterThan(20 * spu.nights[0]!);
  });

  it('Polacy w Niemczech są w danych o powiązaniach', () => {
    expect(index.ties.get('DE-PL')).toBeGreaterThan(500);
  });
});

describe('popyt', () => {
  it('rośnie z wielkością miasta', () => {
    expect(yearlyAverageDemand(index, ap('KTW'), ap('LTN'))).toBeGreaterThan(yearlyAverageDemand(index, ap('KTW'), ap('BOJ')));
  });

  it('jest sezonowy tam, gdzie turystyka jest sezonowa', () => {
    const july = demand(index, ap('KTW'), ap('SPU'), 6);
    const january = demand(index, ap('KTW'), ap('SPU'), 0);
    expect(july.air).toBeGreaterThan(3 * january.air);
    expect(july.tourism).toBeGreaterThan(july.business);
  });

  it('na krótkiej trasie większość ludzi wybiera ląd', () => {
    const krk = demand(index, ap('KTW'), ap('KRK'), 3);
    expect(krk.landShare).toBeGreaterThan(0.95);
    expect(krk.air).toBeLessThan(krk.natural * 0.05);
    const waw = demand(index, ap('KTW'), ap('WAW'), 3);
    expect(waw.landShare).toBeGreaterThan(0.6);
    expect(waw.landShare).toBeLessThan(0.95);
  });

  it('morze po drodze zostawia pasażerów samolotowi', () => {
    const dub = ap('DUB');
    const lhr = ap('LHR');
    expect(landShare(dub, lhr, 450)).toBeLessThan(0.1);
    expect(landShare(ap('WAW'), ap('BER'), 450)).toBeGreaterThan(0.3);
  });

  it('podział na powody podróży sumuje się do całości i jest symetryczny', () => {
    const d = demand(index, ap('KTW'), ap('DTM'), 4);
    expect(d.business + d.tourism + d.vfr).toBeCloseTo(d.air, 6);
    expect(demand(index, ap('DTM'), ap('KTW'), 4).air).toBeCloseTo(d.air, 6);
    expect(demand(index, ap('KTW'), ap('KTW'), 4).air).toBe(0);
  });

  it('trafia w rząd wielkości prawdziwego ruchu Katowice–Dortmund i Katowice–Londyn', () => {
    // Eurostat 2023: około 533 i 336 pasażerów dziennie w jedną stronę.
    const dtm = yearlyAverageDemand(index, ap('KTW'), ap('DTM'));
    const ltn = yearlyAverageDemand(index, ap('KTW'), ap('LTN'));
    // Model zaniża trasy oparte na skupiskach emigracji (Śląsk–Zagłębie Ruhry), bo powiązania zna tylko na poziomie krajów.
    expect(dtm).toBeGreaterThan(533 / 4);
    expect(dtm).toBeLessThan(533 * 3);
    expect(ltn).toBeGreaterThan(336 / 3);
    expect(ltn).toBeLessThan(336 * 3);
  });
});
