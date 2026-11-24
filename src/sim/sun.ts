/** Położenie słońca: dzień, noc i zmierzch na mapie oraz pora dnia w dowolnym miejscu. */
import { deg, rad, type LngLat } from './geo';

/** Deklinacja słońca w stopniach dla dnia roku (1–366). Przybliżenie wystarczające dla gry. */
export function solarDeclination(dayOfYear: number): number {
  return -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
}

/** Długość geograficzna, nad którą słońce stoi w zenicie o danej godzinie UTC. */
export function subsolarLongitude(utcHours: number): number {
  return -(utcHours - 12) * 15;
}

/** Wysokość słońca nad horyzontem w stopniach. Poniżej zera jest po zachodzie. */
export function sunAltitude(utcHours: number, declination: number, at: LngLat): number {
  const hourAngle = rad(at[0] - subsolarLongitude(utcHours));
  const lat = rad(at[1]);
  const d = rad(declination);
  return deg(Math.asin(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(hourAngle)));
}

/**
 * Linia, na której słońce ma zadaną wysokość (0 = terminator, −6 = koniec zmierzchu cywilnego).
 * Zwraca punkt dla każdej długości geograficznej z zakresu. Szerokości są przycięte do Mercatora.
 */
export function sunAltitudeLine(
  utcHours: number,
  declination: number,
  altitude: number,
  lngFrom = -180,
  lngTo = 180,
  step = 2.5,
): LngLat[] {
  const d = rad(declination);
  const sunLng = subsolarLongitude(utcHours);
  const out: LngLat[] = [];
  for (let lng = lngFrom; lng <= lngTo + 1e-9; lng += step) {
    const h = rad(lng - sunLng);
    const a = Math.sin(d);
    const b = Math.cos(d) * Math.cos(h);
    const r = Math.hypot(a, b);
    const v = Math.max(-1, Math.min(1, Math.sin(rad(altitude)) / r));
    // a·sin(φ) + b·cos(φ) = sin(alt)  →  φ = π − asin(v) − atan2(b, a) po stronie, gdzie na północ robi się ciemniej
    let lat = deg(Math.PI - Math.asin(v) - Math.atan2(b, a));
    lat = ((((lat + 180) % 360) + 360) % 360) - 180;
    out.push([lng, Math.max(-84, Math.min(84, lat))]);
  }
  return out;
}

/**
 * Wielokąt obszaru ciemniejszego niż zadana wysokość słońca, w granicach podanego wycinka mapy.
 * Dla ujemnej deklinacji (zima na północy) ciemna strona leży na północ od linii, dla dodatniej na południe.
 */
export function nightPolygon(
  utcHours: number,
  declination: number,
  altitude: number,
  lngFrom = -70,
  lngTo = 90,
): LngLat[] {
  const line = sunAltitudeLine(utcHours, declination, altitude, lngFrom, lngTo);
  const edge = declination < 0 ? 84.5 : -84.5;
  const first = line[0] ?? [lngFrom, 0];
  return [...line, [lngTo, edge], [lngFrom, edge], first];
}
