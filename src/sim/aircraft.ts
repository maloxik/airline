/**
 * Katalog samolotów: prawdziwe typy z przybliżonymi parametrami technicznymi.
 * Ceny i koszty są w skali gry, wyliczone z wielkości i klasy samolotu, a nie z cenników producentów.
 */

/** tp = turbośmigłowy, rj = odrzutowiec regionalny, nb = wąskokadłubowy, wb = szerokokadłubowy. */
export type AircraftClass = 'tp' | 'rj' | 'nb' | 'wb';

export interface AircraftType {
  id: string;
  maker: string;
  name: string;
  cls: AircraftClass;
  seats: number;
  rangeKm: number;
  speedKmh: number;
  /** Najkrótszy pas, z którego typ może regularnie latać. */
  runwayM: number;
  /** Długość kadłuba w metrach (do rysunku). */
  lengthM: number;
  /** Rata leasingu za tydzień, w złotych. */
  leaseWeekly: number;
  /** Cena zakupu na własność, w złotych. */
  price: number;
  /** Koszt jednego lotu niezależny od odległości (obsługa, opłaty, załoga). */
  fixedPerFlight: number;
  /** Koszt każdego kilometra lotu (paliwo, zużycie). */
  costPerKm: number;
  /** Sylwetka na mapie. */
  kind: 'tp' | 'jet';
  /** Nowa generacja: oszczędniejsze silniki, niższy koszt kilometra. */
  efficient: boolean;
}

export const CLASS_LABEL: Record<AircraftClass, string> = {
  tp: 'Turbośmigłowe',
  rj: 'Regionalne',
  nb: 'Wąskokadłubowe',
  wb: 'Szerokokadłubowe',
};

const LEASE_FACTOR: Record<AircraftClass, number> = { tp: 1, rj: 1.5, nb: 1.7, wb: 2.3 };
/** Ile tygodniowych rat kosztuje samolot na własność (około pięciu lat leasingu). */
const PRICE_IN_WEEKS = 250;
/** Przy sprzedaży wraca tyle ceny zakupu. */
export const RESALE_SHARE = 0.6;

type Spec = [id: string, maker: string, name: string, cls: AircraftClass, seats: number, rangeKm: number, speedKmh: number, runwayM: number, lengthM: number, efficient?: boolean];

const SPECS: Spec[] = [
  ['AT46', 'ATR', '42-600', 'tp', 48, 1300, 500, 1100, 22.7],
  ['AT76', 'ATR', '72-600', 'tp', 72, 1400, 510, 1300, 27.2],
  ['DH8D', 'De Havilland Canada', 'Dash 8-400', 'tp', 78, 2000, 667, 1400, 32.8],
  ['CRJ9', 'Bombardier', 'CRJ900', 'rj', 90, 2800, 830, 1900, 36.2],
  ['E175', 'Embraer', 'E175', 'rj', 88, 3700, 800, 1650, 31.7],
  ['E190', 'Embraer', 'E190', 'rj', 100, 4500, 820, 1900, 36.2],
  ['E290', 'Embraer', 'E190-E2', 'rj', 106, 5200, 830, 1700, 36.2, true],
  ['E295', 'Embraer', 'E195-E2', 'rj', 132, 4800, 830, 1900, 41.5, true],
  ['BCS1', 'Airbus', 'A220-100', 'rj', 120, 6300, 830, 1500, 35, true],
  ['BCS3', 'Airbus', 'A220-300', 'nb', 145, 6300, 830, 1900, 38.7, true],
  ['B738', 'Boeing', '737-800', 'nb', 178, 5400, 830, 2300, 39.5],
  ['A320', 'Airbus', 'A320', 'nb', 174, 5700, 830, 2100, 37.6],
  ['A19N', 'Airbus', 'A319neo', 'nb', 140, 6800, 830, 1800, 33.8, true],
  ['A20N', 'Airbus', 'A320neo', 'nb', 180, 6300, 830, 2000, 37.6, true],
  ['B38M', 'Boeing', '737 MAX 8', 'nb', 178, 6500, 840, 2300, 39.5, true],
  ['B3XM', 'Boeing', '737 MAX 10', 'nb', 204, 5700, 840, 2600, 43.8, true],
  ['A21N', 'Airbus', 'A321neo', 'nb', 220, 7400, 830, 2300, 44.5, true],
  ['A21X', 'Airbus', 'A321XLR', 'nb', 200, 8700, 830, 2500, 44.5, true],
  ['A339', 'Airbus', 'A330-900', 'wb', 287, 13300, 880, 2800, 63.7, true],
  ['B789', 'Boeing', '787-9', 'wb', 296, 14000, 900, 2800, 62.8, true],
  ['A359', 'Airbus', 'A350-900', 'wb', 315, 15000, 900, 2700, 66.8, true],
  ['B77W', 'Boeing', '777-300ER', 'wb', 396, 13600, 900, 3100, 73.9],
];

const round = (v: number, step: number): number => Math.round(v / step) * step;

export const AIRCRAFT: readonly AircraftType[] = SPECS.map(([id, maker, name, cls, seats, rangeKm, speedKmh, runwayM, lengthM, efficient = false]) => {
  const leaseWeekly = round(seats * 250 * LEASE_FACTOR[cls], 1000);
  return {
    id,
    maker,
    name,
    cls,
    seats,
    rangeKm,
    speedKmh,
    runwayM,
    lengthM,
    leaseWeekly,
    price: leaseWeekly * PRICE_IN_WEEKS,
    fixedPerFlight: round(1500 + 35 * seats, 10),
    costPerKm: Number(((4 + 0.117 * seats) * (efficient ? 0.9 : 1)).toFixed(1)),
    kind: cls === 'tp' ? 'tp' : 'jet',
    efficient,
  };
});

const BY_ID = new Map(AIRCRAFT.map((t) => [t.id, t]));
export function aircraftType(id: string): AircraftType {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`nieznany typ samolotu: ${id}`);
  return t;
}
