/**
 * Mapa gry: dzienna mapa wektorowa z OpenStreetMap, noc liczona z położenia słońca
 * i prawdziwe światła miast (NASA) nałożone tylko po ciemnej stronie.
 */
import { Map as MlMap, type FilterSpecification, type GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {
  advance,
  dayOfYear,
  gameDate,
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
const NIGHT_LIGHTS =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
const VECTOR = 'openmaptiles';
/** Zmierzch rysujemy jako wiele cienkich warstw, żeby przejście było gładkie. */
const TWILIGHT_STEPS = 32;
const TWILIGHT_STEP_DEG = 0.42;

export type TimeOfDay = 'day' | 'night';

export interface MapTick {
  date: Date;
  timeOfDay: TimeOfDay;
}

export interface WorldMapOptions {
  container: HTMLElement;
  lightsContainer: HTMLElement;
  world: WorldData;
  clock: GameClock;
  onTick: (tick: MapTick) => void;
  onSelect: (airport: Airport | null) => void;
}

export interface WorldMap {
  setSpeed: (speed: number) => void;
  select: (airport: Airport | null) => void;
  destroy: () => void;
}

const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
const polygon = (ring: LngLat[]): Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [ring.map((p) => [p[0], p[1]])] },
});
const source = (map: MlMap, id: string): GeoJSONSource => map.getSource(id) as GeoJSONSource;

export function createWorldMap(opts: WorldMapOptions): WorldMap {
  const { world, clock } = opts;
  const byIata = new Map(world.airports.map((a) => [a.iata, a]));

  const map = new MlMap({
    container: opts.container,
    style: BASE_STYLE,
    center: [13.5, 50],
    zoom: 3.4,
    minZoom: 2.5,
    maxZoom: 16,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true, customAttribution: 'Światła nocne: NASA Earth Observatory · Lotniska: OurAirports' },
  });
  map.touchZoomRotate.disableRotation();

  // Druga mapa z samymi światłami. Tryb „screen” rozjaśnia tylko tam, gdzie pod spodem jest ciemno.
  const lights = new MlMap({
    container: opts.lightsContainer,
    interactive: false,
    attributionControl: false,
    center: [13.5, 50],
    zoom: 3.4,
    style: {
      version: 8,
      sources: { n: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [NIGHT_LIGHTS] } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#000' } },
        {
          id: 'n',
          type: 'raster',
          source: 'n',
          paint: { 'raster-contrast': 0.45, 'raster-brightness-min': 0, 'raster-saturation': -0.15, 'raster-fade-duration': 0 },
        },
      ],
    },
  });

  let speed = 1;
  let raf = 0;
  let last = 0;
  let frame = 0;
  let ready = false;
  let timeOfDay: TimeOfDay | '' = '';
  let destroyed = false;

  const nightData = (): FeatureCollection => {
    const h = utcHours(clock);
    const decl = solarDeclination(dayOfYear(clock));
    return fc(Array.from({ length: TWILIGHT_STEPS }, (_, i) => polygon(nightPolygon(h, decl, -i * TWILIGHT_STEP_DEG))));
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
        const ll = map.unproject([u + w / 2, v + h / 2]);
        const z = sunAltitude(hours, decl, [ll.lng, ll.lat]);
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
      const dx = -a / g;
      const dy = -b / g;
      const th = Math.atan2(dx, -dy);
      const len = Math.abs(w * Math.sin(th)) + Math.abs(h * Math.cos(th));
      const at = (alt: number): string => (len / 2 + (c0 - alt) / g).toFixed(1);
      mask = `linear-gradient(${((th * 180) / Math.PI).toFixed(2)}deg,transparent ${at(1)}px,#000 ${at(-7)}px)`;
    }
    el.style.maskImage = mask;
    el.style.setProperty('-webkit-mask-image', mask);
    el.style.opacity = String(Math.max(0, Math.min(1, (10.5 - map.getZoom()) / 2.5)));
  };

  const applyTimeOfDay = (tod: TimeOfDay): void => {
    const night = tod === 'night';
    for (const id of ['apron-glow', 'twy-lights', 'rwy-lights']) map.setLayoutProperty(id, 'visibility', night ? 'visible' : 'none');
    map.setPaintProperty('airport-labels', 'text-color', night ? '#f1f3f7' : '#14161a');
    map.setPaintProperty('airport-labels', 'text-halo-color', night ? '#0b1326' : '#ffffff');
  };

  const tick = (ts: number): void => {
    if (destroyed) return;
    const dt = Math.min(120, last ? ts - last : 16);
    last = ts;
    frame++;
    advance(clock, dt, speed);
    if (ready && frame % 2 === 0) {
      source(map, 'night').setData(nightData());
      maskLights();
    }
    if (frame % 8 === 0) {
      const c = map.getCenter();
      const alt = sunAltitude(utcHours(clock), solarDeclination(dayOfYear(clock)), [c.lng, c.lat]);
      const tod: TimeOfDay = alt > -4 ? 'day' : 'night';
      if (ready && tod !== timeOfDay) {
        timeOfDay = tod;
        applyTimeOfDay(tod);
      }
      opts.onTick({ date: gameDate(clock), timeOfDay: tod });
    }
    raf = requestAnimationFrame(tick);
  };

  map.on('load', () => {
    restyleBase(map);
    map.addSource('night', { type: 'geojson', data: nightData() });
    map.addLayer({ id: 'night', type: 'fill', source: 'night', paint: { 'fill-color': '#050b1c', 'fill-opacity': 0.034, 'fill-antialias': false } });
    addAirportLights(map);

    map.addSource('airports', {
      type: 'geojson',
      data: fc(
        world.airports.map((a) => ({
          type: 'Feature',
          properties: { iata: a.iata, big: a.size === 'L' ? 1 : 0 },
          geometry: { type: 'Point', coordinates: [a.lng, a.lat] } satisfies Geometry,
        })),
      ),
    });
    map.addSource('selected', { type: 'geojson', data: fc([]) });
    map.addLayer({
      id: 'selected',
      type: 'circle',
      source: 'selected',
      paint: { 'circle-radius': 11, 'circle-color': 'rgba(224,73,47,.18)', 'circle-stroke-color': '#e0492f', 'circle-stroke-width': 2 },
    });
    map.addLayer({
      id: 'airports',
      type: 'circle',
      source: 'airports',
      maxzoom: 11.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'big'], 1, 2.6, 1.4], 7, ['match', ['get', 'big'], 1, 6, 4]],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#2a2e37',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 7, 1.6],
      },
    });
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
      paint: { 'text-color': '#14161a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.3 },
    });
    map.addLayer({ id: 'airports-hit', type: 'circle', source: 'airports', paint: { 'circle-radius': 16, 'circle-opacity': 0 } });

    map.on('click', 'airports-hit', (e) => {
      const iata = e.features?.[0]?.properties?.iata as string | undefined;
      (e.originalEvent as MouseEvent & { handled?: boolean }).handled = true;
      opts.onSelect((iata && byIata.get(iata)) || null);
    });
    map.on('click', (e) => {
      if (!(e.originalEvent as MouseEvent & { handled?: boolean }).handled) opts.onSelect(null);
    });
    map.on('mouseenter', 'airports-hit', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'airports-hit', () => (map.getCanvas().style.cursor = ''));

    const at = opts.container.querySelector('.maplibregl-ctrl-attrib');
    at?.classList.remove('maplibregl-compact-show');
    ready = true;
  });

  const sync = (): void => {
    lights.jumpTo({ center: map.getCenter(), zoom: map.getZoom() });
  };
  map.on('move', sync);
  map.on('resize', () => {
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
      source(map, 'selected').setData(
        fc(airport ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [airport.lng, airport.lat] } }] : []),
      );
      if (airport && map.getZoom() < 4.2) map.easeTo({ center: [airport.lng, airport.lat], zoom: 4.6, duration: 700 });
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      map.remove();
      lights.remove();
    },
  };
}

/** Odzieramy gotowy styl do lądu, wody i granic; z bliska zostają pasy, drogi kołowania, płyty i budynki. */
function restyleBase(map: MlMap): void {
  const closeUp = [
    'building',
    'aeroway-taxiway',
    'aeroway-runway-casing',
    'aeroway-area',
    'aeroway-runway',
    'highway_minor',
    'highway_major_inner',
    'highway_motorway_inner',
  ];
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
