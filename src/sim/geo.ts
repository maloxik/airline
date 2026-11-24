/** Geografia: odległości i łuki po kuli. Moduł sim nie zna przeglądarki ani mapy. */

/** Punkt jako [długość, szerokość] w stopniach, tak jak w GeoJSON. */
export type LngLat = readonly [number, number];

export const EARTH_RADIUS_KM = 6371;

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Odległość po ortodromie w kilometrach (wzór haversine). */
export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Punkty łuku ortodromy od a do b, razem z końcami. `segments` odcinków daje `segments + 1` punktów. */
export function greatCircle(a: LngLat, b: LngLat, segments = 96): LngLat[] {
  const d = distanceKm(a, b) / EARTH_RADIUS_KM;
  if (d < 1e-9) return [a, b];
  const lat1 = rad(a[1]);
  const lng1 = rad(a[0]);
  const lat2 = rad(b[1]);
  const lng2 = rad(b[0]);
  const out: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return out;
}

/** Współrzędna Y w odwzorowaniu Mercatora (bez skali), do liczenia kierunku na mapie. */
export const mercatorY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));

/** Kierunek z a do b tak, jak widać go na mapie w odwzorowaniu Mercatora. 0 = północ, 90 = wschód. */
export function mapBearing(a: LngLat, b: LngLat): number {
  const angle = deg(Math.atan2(rad(b[0] - a[0]), mercatorY(b[1]) - mercatorY(a[1])));
  return (angle + 360) % 360;
}
