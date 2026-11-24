/**
 * Mapa gry w trzech warstwach, od spodu:
 *   1. mapa bazowa (OpenStreetMap) z nocą liczoną z położenia słońca i lotniskami z bliska,
 *   2. prawdziwe światła miast (NASA), widoczne tylko po ciemnej stronie,
 *   3. warstwa gry: lotniska, trasy, samoloty, popyt. Zawsze na wierzchu, więc nic jej nie zasłania.
 * Sterujemy warstwą gry; dwie pozostałe podążają za jej kamerą.
 */
import { Map as MlMap, type ExpressionSpecification, type FilterSpecification, type GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import {
  advance,
  dayOfYear,
  gameDate,
  greatCircle,
  mapBearing,
  nightPolygon,
  solarDeclination,
  sunAltitude,
  utcHours,
  type Airport,
  type GameClock,
  type LngLat,
  type WorldData,
} from '../sim';

const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const NIGHT_LIGHTS =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
const VECTOR = 'openmaptiles';
/** Zmierzch rysujemy jako wiele cienkich warstw, żeby przejście było gładkie. */
const TWILIGHT_STEPS = 32;
const TWILIGHT_STEP_DEG = 0.42;
const START = { center: [13.5, 50] as [number, number], zoom: 3.4 };

export type TimeOfDay = 'day' | 'night';

export interface MapTick {
  date: Date;
  timeOfDay: TimeOfDay;
  /** Miesiąc gry, 0 = styczeń. */
  month: number;
  /** Minuty gry od początku rozgrywki. */
  minutes: number;
  /** Minuta doby w czasie lokalnym bazy. */
  minuteOfDay: number;
}

/** Popyt z bazy do pozostałych lotnisk, do pokazania na mapie. */
export interface DemandView {
  base: Airport;
  /** Kod IATA → podróżni dziennie w jedną stronę: samolotem i wszyscy razem. */
  values: Map<string, { air: number; natural: number }>;
}

/** Samolot w powietrzu w danej chwili. */
export interface FlightOnMap {
  from: LngLat;
  to: LngLat;
  /** 0–1, część trasy już przebyta. */
  progress: number;
  kind: 'tp' | 'jet';
  /** true = lot na zlecenie (cargo albo czarter), rysowany inaczej niż lot rozkładowy. */
  job?: boolean;
}

export interface WorldMapOptions {
  /** Warstwa gry (na wierzchu, przyjmuje dotyk). */
  container: HTMLElement;
  baseContainer: HTMLElement;
  lightsContainer: HTMLElement;
  world: WorldData;
  clock: GameClock;
  /** Kolor linii gracza: trasy, samoloty, baza. */
  color: string;
  onTick: (tick: MapTick) => void;
  onSelect: (airport: Airport | null) => void;
  /** Samoloty gracza w powietrzu o danej minucie doby. Wołane w każdej klatce. */
  getFlights: (minuteOfDay: number) => FlightOnMap[];
}

export interface WorldMap {
  setSpeed: (speed: number) => void;
  select: (airport: Airport | null) => void;
  /** Włącza widok popytu z podanej bazy albo go wyłącza (null). */
  setDemand: (view: DemandView | null) => void;
  /** Baza i lotniska, do których gracz lata. */
  setNetwork: (base: Airport | null, served: Airport[]) => void;
  /** Zmienia kolor linii gracza na mapie. */
  setColor: (color: string) => void;
  /** Płynnie przenosi kamerę. `linear` daje równy, powolny przelot zamiast przyspieszania i hamowania. */
  moveCamera: (to: { center: [number, number]; zoom: number; durationMs: number; linear?: boolean; offsetY?: number }) => void;
  /** Włącza widok znajomości marki (kod IATA → 0–1) albo go wyłącza (null). */
  setBrand: (values: Map<string, number> | null) => void;
  destroy: () => void;
}

type Expr = ExpressionSpecification;
const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
const point = (ll: LngLat, properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [ll[0], ll[1]] } });
const lineString = (pts: LngLat[], properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: pts.map((p) => [p[0], p[1]]) },
});
const polygon = (ring: LngLat[]): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring.map((p) => [p[0], p[1]])] } });
const source = (map: MlMap, id: string): GeoJSONSource => map.getSource(id) as GeoJSONSource;
const ll = (a: Airport): LngLat => [a.lng, a.lat];

/** Sylwetki samolotów widziane z góry, nosem do góry. */
const TOP_VIEW = {
  jet: [
    'M12 .8C13 .8 13.6 2.6 13.6 4.6V9L22.4 14.4V16.2L13.6 13.7 13.4 19.2 16.5 21.4V22.8L12 21.8 7.5 22.8V21.4L10.6 19.2 10.4 13.7 1.6 16.2V14.4L10.4 9V4.6C10.4 2.6 11 .8 12 .8Z',
    'M6.6 10.3h1.5v2.8h-1.5zM15.9 10.3h1.5v2.8h-1.5z',
  ],
  tp: [
    'M12 1.3C12.9 1.3 13.4 2.9 13.4 4.8V8.5L22.8 9.3V11.3L13.4 12 13.2 19.2 16.7 20.1V21.7L12 21.3 7.3 21.7V20.1L10.8 19.2 10.6 12 1.2 11.3V9.3L10.6 8.5V4.8C10.6 2.9 11.1 1.3 12 1.3Z',
    'M6.2 6.9h1.6v5h-1.6zM16.2 6.9h1.6v5h-1.6z',
  ],
} as const;
function planeImage(kind: 'tp' | 'jet', fill: string, edge?: string): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 60;
  const x = c.getContext('2d')!;
  x.translate(6, 6);
  x.scale(2, 2);
  const body = new Path2D(TOP_VIEW[kind][0]);
  const engines = new Path2D(TOP_VIEW[kind][1]);
  x.lineJoin = 'round';
  if (edge) {
    x.lineWidth = 2.4;
    x.strokeStyle = edge;
    x.stroke(body);
    x.stroke(engines);
  }
  x.fillStyle = fill;
  x.fill(engines);
  x.fill(body);
  return x.getImageData(0, 0, 60, 60);
}

export function createWorldMap(opts: WorldMapOptions): WorldMap {
  const { world, clock } = opts;
  const byIata = new Map(world.airports.map((a) => [a.iata, a]));

  // 1. Mapa bazowa: nie przyjmuje dotyku, tylko podąża za kamerą.
  const base = new MlMap({ container: opts.baseContainer, style: BASE_STYLE, interactive: false, attributionControl: false, ...START });

  // 2. Światła miast. Tryb „screen” rozjaśnia tylko tam, gdzie pod spodem jest ciemno.
  const lights = new MlMap({
    container: opts.lightsContainer,
    interactive: false,
    attributionControl: false,
    ...START,
    style: {
      version: 8,
      sources: { n: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [NIGHT_LIGHTS] } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#000' } },
        { id: 'n', type: 'raster', source: 'n', paint: { 'raster-contrast': 0.45, 'raster-brightness-min': 0, 'raster-saturation': -0.15, 'raster-fade-duration': 0 } },
      ],
    },
  });

  // 3. Warstwa gry: przezroczysta, na wierzchu, steruje kamerą.
  const map = new MlMap({
    container: opts.container,
    style: { version: 8, glyphs: GLYPHS, sources: {}, layers: [] },
    ...START,
    minZoom: 1.3,
    maxZoom: 16,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: {
      compact: true,
      customAttribution: '© OpenStreetMap · OpenFreeMap · NASA · OurAirports · GeoNames · Eurostat · © EuroGeographics · Bank Światowy',
    },
  });
  map.touchZoomRotate.disableRotation();

  let speed = 1;
  let raf = 0;
  let last = 0;
  let frame = 0;
  let baseReady = false;
  let ready = false;
  let timeOfDay: TimeOfDay | '' = '';
  let destroyed = false;
  let pendingDemand: DemandView | null = null;
  let pendingNetwork: { base: Airport | null; served: Airport[] } = { base: null, served: [] };
  let pendingBrand: Map<string, number> | null = null;
  let color = opts.color;
  /** Czas lokalny bazy względem UTC, w minutach: liczony z długości geograficznej. */
  let localOffsetMin = 60;

  const applyColor = (): void => {
    map.setPaintProperty('routes', 'line-color', color);
    map.setPaintProperty('selected', 'circle-stroke-color', color);
    map.setPaintProperty('served', 'circle-color', color);
    map.setPaintProperty('base', 'circle-stroke-color', color);
    map.setPaintProperty('brand', 'circle-color', color);
    for (const k of ['jet', 'tp'] as const) map.updateImage(`plane-${k}`, planeImage(k, color, '#fff'));
  };

  const applyBrand = (): void => {
    map.setLayoutProperty('brand', 'visibility', pendingBrand ? 'visible' : 'none');
    map.setLayoutProperty('brand-labels', 'visibility', pendingBrand ? 'visible' : 'none');
    const rows = pendingBrand ? [...pendingBrand].map(([iata, a]) => ({ a, airport: byIata.get(iata) })).filter((r) => r.airport) : [];
    source(map, 'brand').setData(fc(rows.map((r) => point(ll(r.airport!), { a: r.a, label: `${r.airport!.iata} ${Math.round(r.a * 100)}%` }))));
  };
  const arcs = new Map<string, LngLat[]>();
  const arc = (from: LngLat, to: LngLat): LngLat[] => {
    const key = `${from[0]},${from[1]}>${to[0]},${to[1]}`;
    let pts = arcs.get(key);
    if (!pts) {
      pts = greatCircle(from, to, 96);
      arcs.set(key, pts);
    }
    return pts;
  };

  const nightData = (): FeatureCollection => {
    const h = utcHours(clock);
    const decl = solarDeclination(dayOfYear(clock));
    return fc(Array.from({ length: TWILIGHT_STEPS }, (_, i) => polygon(nightPolygon(h, decl, -i * TWILIGHT_STEP_DEG, -180, 180))));
  };

  /** Światła widać tylko po nocnej stronie: maska CSS ustawiana według wysokości słońca na ekranie. */
  const maskLights = (): void => {
    const el = opts.lightsContainer;
    const w = opts.container.clientWidth;
    const h = opts.container.clientHeight;
    const hours = utcHours(clock);
    const decl = solarDeclination(dayOfYear(clock));
    let suz = 0;
    let svz = 0;
    let suu = 0;
    let svv = 0;
    let sz = 0;
    for (const fx of [-0.5, 0, 0.5]) {
      for (const fy of [-0.5, 0, 0.5]) {
        const u = fx * w;
        const v = fy * h;
        const p = map.unproject([u + w / 2, v + h / 2]);
        const z = sunAltitude(hours, decl, [p.lng, p.lat]);
        suz += u * z;
        svz += v * z;
        suu += u * u;
        svv += v * v;
        sz += z;
      }
    }
    const a = suz / suu;
    const b = svz / svv;
    const c0 = sz / 9;
    const g = Math.hypot(a, b);
    let mask: string;
    if (g < 1e-5) {
      const o = Math.max(0, Math.min(1, (1 - c0) / 8));
      mask = `linear-gradient(rgba(0,0,0,${o}),rgba(0,0,0,${o}))`;
    } else {
      const th = Math.atan2(-a / g, b / g);
      const len = Math.abs(w * Math.sin(th)) + Math.abs(h * Math.cos(th));
      const at = (alt: number): string => (len / 2 + (c0 - alt) / g).toFixed(1);
      mask = `linear-gradient(${((th * 180) / Math.PI).toFixed(2)}deg,transparent ${at(1)}px,#000 ${at(-7)}px)`;
    }
    el.style.maskImage = mask;
    el.style.setProperty('-webkit-mask-image', mask);
    el.style.opacity = String(Math.max(0, Math.min(1, (10.5 - map.getZoom()) / 2.5)));
  };

  const applyDemand = (view: DemandView | null): void => {
    const on = Boolean(view);
    for (const id of ['airports', 'airports-halo', 'airport-labels', 'served']) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
    for (const id of ['demand-ring', 'demand-core', 'demand-labels']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (!view) return;
    const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
    source(map, 'demand').setData(
      fc(
        world.airports
          .filter((a) => a.iata !== view.base.iata)
          .map((a) => {
            const d = view.values.get(a.iata) ?? { air: 0, natural: 0 };
            const rc = clamp(Math.sqrt(d.air) * 0.85, 1.6, 26);
            return point(ll(a), { iata: a.iata, air: d.air, label: `${a.iata} ${Math.round(d.air)}`, rc, rr: clamp(Math.sqrt(d.natural) * 0.85, rc, 34) });
          }),
      ),
    );
  };

  const applyNetwork = (): void => {
    const { base: b, served } = pendingNetwork;
    if (b) localOffsetMin = Math.round(b.lng / 15) * 60;
    source(map, 'base').setData(fc(b ? [point(ll(b), { iata: b.iata })] : []));
    source(map, 'served').setData(fc(served.map((a) => point(ll(a), { iata: a.iata }))));
    source(map, 'routes').setData(fc(b ? served.map((a) => lineString(arc(ll(b), ll(a)), { to: a.iata })) : []));
  };

  const tick = (ts: number): void => {
    if (destroyed) return;
    const dt = Math.min(120, last ? ts - last : 16);
    last = ts;
    frame++;
    advance(clock, dt, speed);
    const date = gameDate(clock);
    const minuteOfDay = (((date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + localOffsetMin) % 1440) + 1440) % 1440;

    if (baseReady && frame % 2 === 0) {
      source(base, 'night').setData(nightData());
      maskLights();
    }
    if (ready) {
      const planes: Feature[] = [];
      const trails: Feature[] = [];
      for (const f of opts.getFlights(minuteOfDay)) {
        const pts = arc(f.from, f.to);
        // Łagodny start i lądowanie: samolot rozpędza się i zwalnia przy lotniskach.
        const e = f.progress < 0.5 ? 2 * f.progress * f.progress : 1 - 2 * (1 - f.progress) * (1 - f.progress);
        const g = e * (pts.length - 1);
        const i = Math.min(pts.length - 2, Math.floor(g));
        const k = g - i;
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const pos: LngLat = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        planes.push(point(pos, { k: f.kind, b: mapBearing(a, b), o: f.job ? 'job' : 'plane' }));
        trails.push(lineString([...pts.slice(Math.max(0, i - 13), i + 1), pos]));
      }
      source(map, 'planes').setData(fc(planes));
      source(map, 'trails').setData(fc(trails));
    }
    if (frame % 8 === 0) {
      const c = map.getCenter();
      const tod: TimeOfDay = sunAltitude(utcHours(clock), solarDeclination(dayOfYear(clock)), [c.lng, c.lat]) > -4 ? 'day' : 'night';
      if (baseReady && tod !== timeOfDay) {
        timeOfDay = tod;
        for (const id of ['apron-glow', 'twy-lights', 'rwy-lights']) base.setLayoutProperty(id, 'visibility', tod === 'night' ? 'visible' : 'none');
      }
      opts.onTick({ date, timeOfDay: tod, month: date.getUTCMonth(), minutes: clock.minutes, minuteOfDay });
    }
    raf = requestAnimationFrame(tick);
  };

  base.on('load', () => {
    restyleBase(base);
    base.addSource('night', { type: 'geojson', data: nightData() });
    base.addLayer({ id: 'night', type: 'fill', source: 'night', paint: { 'fill-color': '#050b1c', 'fill-opacity': 0.034, 'fill-antialias': false } });
    addAirportLights(base);
    baseReady = true;
  });

  map.on('load', () => {
    const byZoom = (prop: string): Expr => ['interpolate', ['linear'], ['zoom'], 3, ['*', ['get', prop], 0.55], 7, ['*', ['get', prop], 1.5]];
    const empty = (id: string): void => void map.addSource(id, { type: 'geojson', data: fc([]) });
    map.addSource('airports', { type: 'geojson', data: fc(world.airports.map((a) => point(ll(a), { iata: a.iata, big: a.size === 'L' ? 1 : 0 }))) });
    for (const id of ['routes', 'selected', 'served', 'base', 'demand', 'trails', 'planes', 'brand']) empty(id);
    // Znajomość marki: plama w kolorze linii, tym większa, im więcej ludzi zna linię w tym mieście.
    map.addLayer({
      id: 'brand',
      type: 'circle',
      source: 'brand',
      layout: { visibility: 'none' },
      paint: {
        'circle-color': color,
        'circle-opacity': 0.32,
        'circle-blur': 0.7,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['*', ['get', 'a'], 16], 4, ['*', ['get', 'a'], 46], 7, ['*', ['get', 'a'], 130]],
      },
    });

    map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.55 } });
    map.addLayer({ id: 'routes', type: 'line', source: 'routes', layout: { 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 2 } });
    map.addLayer({
      id: 'selected',
      type: 'circle',
      source: 'selected',
      paint: { 'circle-radius': 12, 'circle-color': 'rgba(255,255,255,.25)', 'circle-stroke-color': color, 'circle-stroke-width': 2.5 },
    });
    // Ciemna podkładka pod każdym lotniskiem: dzięki niej biały punkt nie ginie nocą wśród świateł miast.
    map.addLayer({
      id: 'airports-halo',
      type: 'circle',
      source: 'airports',
      maxzoom: 11.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1.5, 2.2, 3, ['match', ['get', 'big'], 1, 5.5, 3.8], 7, ['match', ['get', 'big'], 1, 11, 8]],
        'circle-color': '#0b1326',
        'circle-opacity': 0.55,
        'circle-blur': 0.35,
      },
    });
    map.addLayer({
      id: 'airports',
      type: 'circle',
      source: 'airports',
      maxzoom: 11.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1.5, 1.1, 3, ['match', ['get', 'big'], 1, 3, 1.9], 7, ['match', ['get', 'big'], 1, 6.5, 4.5]],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#14161a',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1.5, 0.5, 3, 1, 7, 1.8],
      },
    });
    map.addLayer({
      id: 'served',
      type: 'circle',
      source: 'served',
      maxzoom: 11.5,
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 7, 7.5], 'circle-color': color, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    });
    // Widok popytu: szara obwódka = wszyscy podróżni, niebieskie koło = ci, którzy polecą samolotem.
    map.addLayer({
      id: 'demand-ring',
      type: 'circle',
      source: 'demand',
      maxzoom: 11.5,
      layout: { visibility: 'none', 'circle-sort-key': ['-', 0, ['get', 'rr']] },
      paint: { 'circle-radius': byZoom('rr'), 'circle-color': 'rgba(150,156,168,.28)', 'circle-stroke-color': 'rgba(120,126,138,.85)', 'circle-stroke-width': 1 },
    });
    map.addLayer({
      id: 'demand-core',
      type: 'circle',
      source: 'demand',
      maxzoom: 11.5,
      layout: { visibility: 'none', 'circle-sort-key': ['-', 0, ['get', 'rc']] },
      paint: { 'circle-radius': byZoom('rc'), 'circle-color': '#2a5bd7', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 },
    });
    map.addLayer({
      id: 'base',
      type: 'circle',
      source: 'base',
      maxzoom: 11.5,
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4.5, 7, 9], 'circle-color': '#ffffff', 'circle-stroke-color': color, 'circle-stroke-width': 4.5 },
    });
    const label = { 'text-color': '#ffffff', 'text-halo-color': '#14161a', 'text-halo-width': 1.6 };
    map.addLayer({
      id: 'airport-labels',
      type: 'symbol',
      source: 'airports',
      maxzoom: 11.5,
      filter: ['any', ['all', ['==', ['get', 'big'], 1], ['>=', ['zoom'], 4.2]], ['>=', ['zoom'], 6]],
      layout: {
        'text-field': ['get', 'iata'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9.5, 7, 12],
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'symbol-sort-key': ['match', ['get', 'big'], 1, 0, 1],
      },
      paint: label,
    });
    map.addLayer({
      id: 'demand-labels',
      type: 'symbol',
      source: 'demand',
      maxzoom: 11.5,
      filter: ['>=', ['get', 'air'], 1],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10.5, 7, 13],
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'symbol-sort-key': ['-', 0, ['get', 'air']],
      },
      paint: label,
    });
    map.addLayer({
      id: 'brand-labels',
      type: 'symbol',
      source: 'brand',
      layout: { visibility: 'none', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11.5, 'text-offset': [0, 1], 'text-anchor': 'top', 'symbol-sort-key': ['-', 0, ['get', 'a']] },
      paint: label,
    });
    map.addLayer({ id: 'trails', type: 'line', source: 'trails', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.65, 'line-blur': 1 } });
    for (const k of ['jet', 'tp'] as const) {
      map.addImage(`shadow-${k}`, planeImage(k, '#000'), { pixelRatio: 2 });
      map.addImage(`plane-${k}`, planeImage(k, color, '#fff'), { pixelRatio: 2 });
      map.addImage(`job-${k}`, planeImage(k, '#ffffff', '#14161a'), { pixelRatio: 2 });
    }
    const planeLayout = {
      'icon-rotate': ['get', 'b'] as Expr,
      'icon-rotation-alignment': 'map' as const,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 4, 0.8, 7, 1.25] as Expr,
    };
    map.addLayer({ id: 'shadows', type: 'symbol', source: 'planes', layout: { ...planeLayout, 'icon-image': ['concat', 'shadow-', ['get', 'k']] }, paint: { 'icon-opacity': 0.22, 'icon-translate': [4, 6] } });
    map.addLayer({ id: 'planes', type: 'symbol', source: 'planes', layout: { ...planeLayout, 'icon-image': ['concat', ['get', 'o'], '-', ['get', 'k']] } });
    map.addLayer({ id: 'airports-hit', type: 'circle', source: 'airports', paint: { 'circle-radius': 16, 'circle-opacity': 0 } });

    type Handled = MouseEvent & { handled?: boolean };
    map.on('click', 'airports-hit', (e) => {
      // Gdy pod palcem jest kilka lotnisk, wybieramy to, do którego gracz lata, potem większe.
      const hits = (e.features ?? []).map((f) => byIata.get(f.properties?.iata as string)).filter((a): a is Airport => Boolean(a));
      const servedSet = new Set(pendingNetwork.served.map((a) => a.iata));
      hits.sort((x, y) => Number(servedSet.has(y.iata)) - Number(servedSet.has(x.iata)) || Number(y.size === 'L') - Number(x.size === 'L') || y.catch - x.catch);
      (e.originalEvent as Handled).handled = true;
      opts.onSelect(hits[0] ?? null);
    });
    map.on('click', (e) => {
      if (!(e.originalEvent as Handled).handled) opts.onSelect(null);
    });
    map.on('mouseenter', 'airports-hit', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'airports-hit', () => (map.getCanvas().style.cursor = ''));

    opts.container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    ready = true;
    applyNetwork();
    applyDemand(pendingDemand);
    applyBrand();
  });

  const sync = (): void => {
    const camera = { center: map.getCenter(), zoom: map.getZoom() };
    base.jumpTo(camera);
    lights.jumpTo(camera);
  };
  map.on('move', sync);
  map.on('resize', () => {
    base.resize();
    lights.resize();
    sync();
  });

  raf = requestAnimationFrame(tick);

  return {
    setSpeed: (s) => {
      speed = s;
    },
    select: (airport) => {
      if (!ready) return;
      source(map, 'selected').setData(fc(airport ? [point(ll(airport))] : []));
      if (airport && map.getZoom() < 3.2) map.easeTo({ center: [airport.lng, airport.lat], zoom: 4, duration: 700 });
    },
    setDemand: (view) => {
      pendingDemand = view;
      if (ready) applyDemand(view);
    },
    setNetwork: (b, served) => {
      pendingNetwork = { base: b, served };
      if (ready) applyNetwork();
    },
    setColor: (c) => {
      color = c;
      if (ready) applyColor();
    },
    moveCamera: (to) => {
      map.stop();
      map.easeTo({ center: to.center, zoom: to.zoom, duration: to.durationMs, offset: [0, to.offsetY ?? 0], ...(to.linear ? { easing: (t: number) => t } : {}) });
    },
    setBrand: (values) => {
      pendingBrand = values;
      if (ready) applyBrand();
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      map.remove();
      lights.remove();
      base.remove();
    },
  };
}

/** Odzieramy gotowy styl do lądu, wody i granic; z bliska zostają pasy, drogi kołowania, płyty i budynki. */
function restyleBase(map: MlMap): void {
  const closeUp = ['building', 'aeroway-taxiway', 'aeroway-runway-casing', 'aeroway-area', 'aeroway-runway', 'highway_minor', 'highway_major_inner', 'highway_motorway_inner'];
  const keep = new Set(['background', 'water', 'boundary_2', 'label_country_1', 'label_country_2', ...closeUp]);
  for (const layer of map.getStyle().layers) {
    if (!keep.has(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
  map.setPaintProperty('background', 'background-color', '#eef0ea');
  map.setPaintProperty('water', 'fill-color', '#bcd9e8');
  map.setPaintProperty('boundary_2', 'line-color', '#c7cbc4');
  map.setPaintProperty('boundary_2', 'line-width', 0.7);
  for (const id of ['label_country_1', 'label_country_2']) {
    map.setPaintProperty(id, 'text-color', '#9aa39c');
    map.setPaintProperty(id, 'text-halo-width', 0);
  }
  for (const id of closeUp) map.setLayerZoomRange(id, 10.5, 24);
  for (const id of ['highway_minor', 'highway_major_inner', 'highway_motorway_inner']) map.setPaintProperty(id, 'line-color', '#dfe2dc');
  map.setPaintProperty('building', 'fill-color', '#d0d4da');
  map.setPaintProperty('building', 'fill-outline-color', '#b4bac3');
  map.setPaintProperty('aeroway-taxiway', 'line-color', '#bfc4cc');
  map.setPaintProperty('aeroway-runway-casing', 'line-color', '#c9cdd3');
  map.setPaintProperty('aeroway-runway', 'line-color', '#8f96a1');
  map.setPaintProperty('aeroway-area', 'fill-color', '#a3aab4');
  map.addLayer(
    {
      id: 'apron',
      type: 'fill',
      source: VECTOR,
      'source-layer': 'aeroway',
      minzoom: 10.5,
      filter: ['all', ['==', ['get', 'class'], 'apron'], ['==', ['geometry-type'], 'Polygon']],
      paint: { 'fill-color': '#d6d9de' },
    },
    'aeroway-taxiway',
  );
  map.addLayer({
    id: 'rwy-mark',
    type: 'line',
    source: VECTOR,
    'source-layer': 'aeroway',
    minzoom: 12.5,
    filter: ['all', ['==', ['get', 'class'], 'runway'], ['==', ['geometry-type'], 'LineString']],
    paint: { 'line-color': '#fff', 'line-width': 1.2, 'line-dasharray': [7, 7] },
  });
}

/** Nocą: światła krawędzi pasa, niebieskie światła dróg kołowania, poświata płyty. Domyślnie wyłączone. */
function addAirportLights(map: MlMap): void {
  const is = (cls: string, geom: string): FilterSpecification => ['all', ['==', ['get', 'class'], cls], ['==', ['geometry-type'], geom]];
  map.addLayer({
    id: 'apron-glow',
    type: 'fill',
    source: VECTOR,
    'source-layer': 'aeroway',
    minzoom: 11,
    layout: { visibility: 'none' },
    filter: is('apron', 'Polygon'),
    paint: { 'fill-color': '#ffd98a', 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'twy-lights',
    type: 'line',
    source: VECTOR,
    'source-layer': 'aeroway',
    minzoom: 12.5,
    layout: { visibility: 'none', 'line-cap': 'round' },
    filter: is('taxiway', 'LineString'),
    paint: { 'line-color': '#6fb0ff', 'line-width': 2.2, 'line-dasharray': [0.01, 4] },
  });
  map.addLayer({
    id: 'rwy-lights',
    type: 'line',
    source: VECTOR,
    'source-layer': 'aeroway',
    minzoom: 11,
    layout: { visibility: 'none', 'line-cap': 'round' },
    filter: is('runway', 'LineString'),
    paint: {
      'line-color': '#fff4c8',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 4],
      'line-gap-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 4, 17, 50],
      'line-dasharray': [0.01, 2.4],
    },
  });
}
