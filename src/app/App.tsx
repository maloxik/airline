import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AIRCRAFT,
  advanceMoney,
  aircraftType,
  canOpenRoute,
  changePrice,
  changeRotations,
  closeRoute,
  demand,
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
  typicalPrice,
  weeklyResult,
  type AircraftType,
  type Airport,
  type Demand,
  type FlightPhase,
  type GameClock,
  type GameState,
  type RealRoutes,
  type Route,
  type WorldData,
  type WorldIndex,
} from '../sim';
import { aircraftSvg } from './aircraftArt';
import { createWorldMap, type FlightOnMap, type WorldMap } from './map';

const SPEEDS = [1, 4, 0] as const;
const BRAND = '#e0492f';
const SAVE_KEY = 'airline-save-v1';
const START_ISO = '2027-02-16T04:05:00Z';
const COUNTRY = new Intl.DisplayNames(['pl'], { type: 'region' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });
const MONTHS = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];
const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');
const mln = (n: number): string => (n / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: n < 1e6 ? 2 : 1 });
const signed = (n: number): string => `${n < 0 ? '−' : '+'}${num(Math.abs(n) / 1000)} tys.`;
const tone = (n: number): string => (n < 0 ? 'neg' : 'pos');
const hm = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const duration = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h ` : '') + `${Math.round(min % 60)} min`;
const cityOf = (a: Airport): string => a.city || a.name;

type PanelKey = 'routes' | 'fleet' | 'demand' | 'brand' | 'finance';
const PANELS: { key: PanelKey; label: string; icon: ReactNode }[] = [
  {
    key: 'routes',
    label: 'Trasy',
    icon: (
      <>
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <path d="M7 17c8-.5 3-10 10-10.5" />
      </>
    ),
  },
  { key: 'fleet', label: 'Flota', icon: <path d="M12 2.5c.8 0 1.4 1 1.4 2.4v4.6l7.6 4.4v1.9l-7.6-2.2v4.8l2.2 1.6v1.5L12 20.6l-3.6.9V20l2.2-1.6v-4.8L3 15.8v-1.9l7.6-4.4V4.9c0-1.4.6-2.4 1.4-2.4z" /> },
  {
    key: 'demand',
    label: 'Popyt',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 3" />
      </>
    ),
  },
  { key: 'brand', label: 'Marka', icon: <path d="M4 10v4l3 .6V9.4zM7 9.4 17 5v14L7 14.6M17 9.2a3 3 0 0 1 0 5.6M9.6 15.8l1 3.7" /> },
  { key: 'finance', label: 'Finanse', icon: <path d="M4 19V11M10 19V5M16 19v-6M21.5 19h-19" /> },
];

interface Save {
  v: 1;
  game: GameState;
  minutes: number;
}
function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    return s.v === 1 && s.game?.baseIata && Array.isArray(s.game.fleet) ? s : null;
  } catch {
    return null;
  }
}
const freshGame = (): GameState => newGame('KTW', 'Silesia Air');

async function loadJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

function phaseText(phase: FlightPhase, dest: Airport): string {
  switch (phase.at) {
    case 'outbound':
      return `W powietrzu, ląduje o ${hm(phase.landsMin)}`;
    case 'inbound':
      return `Wraca do bazy, ląduje o ${hm(phase.landsMin)}`;
    case 'destination':
      return `Obsługa na ziemi (${cityOf(dest)}), odlot o ${hm(phase.departsMin)}`;
    case 'base':
      return phase.departsMin === null ? 'W bazie, na dziś koniec lotów' : `W bazie, odlot o ${hm(phase.departsMin)}`;
  }
}

const CloseIcon = () => (
  <svg viewBox="0 0 13 13">
    <path d="M2 2l9 9M11 2l-9 9" />
  </svg>
);
const Art = ({ type, airline }: { type: AircraftType; airline: string }) => <div className="art" dangerouslySetInnerHTML={{ __html: aircraftSvg(type, BRAND, airline) }} />;

export function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const baseEl = useRef<HTMLDivElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const saved = useMemo(loadSave, []);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [realRoutes, setRealRoutes] = useState<RealRoutes | null>(null);
  const [error, setError] = useState('');
  const [game, setGame] = useState<GameState>(() => saved?.game ?? freshGame());
  const [selected, setSelected] = useState<Airport | null>(null);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [fleetTab, setFleetTab] = useState<'mine' | 'market'>('mine');
  const [date, setDate] = useState<Date | null>(null);
  const [month, setMonth] = useState(1);
  const [minuteOfDay, setMinuteOfDay] = useState(0);
  const [speedIx, setSpeedIx] = useState(0);
  const [demandOn, setDemandOn] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const gameRef = useRef(game);
  gameRef.current = game;
  const indexRef = useRef<WorldIndex | null>(null);
  const monthRef = useRef(month);
  monthRef.current = month;
  const minutesRef = useRef(saved?.minutes ?? 0);
  const clockRef = useRef<GameClock | null>(null);

  useEffect(() => {
    loadJson<WorldData>('/data/world.json')
      .then(setWorld)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    loadJson<RealRoutes>('/data/real-routes.json')
      .then(setRealRoutes)
      .catch(() => setRealRoutes(null));
  }, []);

  const index = useMemo(() => (world ? indexWorld(world) : null), [world]);
  indexRef.current = index;
  const base = index?.airports.get(game.baseIata) ?? null;
  const real = useMemo(() => new Map(realRoutes?.routes ?? []), [realRoutes]);

  /** Popyt z bazy do każdego lotniska w bieżącym miesiącu. */
  const fromBase = useMemo(() => {
    const out = new Map<string, Demand>();
    if (!index || !base) return out;
    for (const a of index.airports.values()) if (a !== base) out.set(a.iata, demand(index, base, a, month));
    return out;
  }, [index, base, month]);

  // Mapa powstaje raz, gdy są dane świata.
  useEffect(() => {
    if (!world || !mapEl.current || !baseEl.current || !lightsEl.current) return;
    const clock: GameClock = { startIso: START_ISO, minutes: minutesRef.current };
    clockRef.current = clock;
    const m = createWorldMap({
      container: mapEl.current,
      baseContainer: baseEl.current,
      lightsContainer: lightsEl.current,
      world,
      clock,
      onTick: (t) => {
        setDate(t.date);
        setMonth(t.month);
        setMinuteOfDay(t.minuteOfDay);
        const ix = indexRef.current;
        const passed = t.minutes - minutesRef.current;
        minutesRef.current = t.minutes;
        if (ix && passed > 0) setGame((g) => advanceMoney(ix, g, t.month, passed));
      },
      onSelect: (airport) => {
        setPanel(null);
        setSelected(airport);
      },
      getFlights: (mod) => {
        const ix = indexRef.current;
        const g = gameRef.current;
        const home = ix?.airports.get(g.baseIata);
        if (!ix || !home) return [];
        const out: FlightOnMap[] = [];
        g.routes.forEach((r, slot) => {
          const dest = ix.airports.get(r.to);
          const plane = g.fleet.find((p) => p.reg === r.planeReg);
          if (!dest || !plane) return;
          const type = aircraftType(plane.typeId);
          const phase = flightPhase(r, routeKm(ix, g, r.to), type, mod, slot);
          if (phase.at === 'outbound') out.push({ from: [home.lng, home.lat], to: [dest.lng, dest.lat], progress: phase.progress, kind: type.kind });
          else if (phase.at === 'inbound') out.push({ from: [dest.lng, dest.lat], to: [home.lng, home.lat], progress: phase.progress, kind: type.kind });
        });
        return out;
      },
    });
    mapRef.current = m;
    return () => {
      mapRef.current = null;
      m.destroy();
    };
  }, [world]);

  useEffect(() => {
    mapRef.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    mapRef.current?.setDemand(demandOn && base ? { base, values: fromBase } : null);
  }, [demandOn, base, fromBase, world]);
  const servedKey = game.routes.map((r) => r.to).join(',');
  useEffect(() => {
    if (!index) return;
    mapRef.current?.setNetwork(
      base,
      game.routes.map((r) => index.airports.get(r.to)).filter((a): a is Airport => Boolean(a)),
    );
  }, [servedKey, base, index]);
  const speed = SPEEDS[speedIx] ?? 1;
  useEffect(() => {
    mapRef.current?.setSpeed(speed);
  }, [speed, world]);

  // Zapis gry: co kilka sekund i przy schowaniu aplikacji.
  useEffect(() => {
    const save = (): void => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, game: gameRef.current, minutes: minutesRef.current } satisfies Save));
      } catch {
        /* brak miejsca albo zablokowany zapis: gra działa dalej bez zapisu */
      }
    };
    const id = setInterval(save, 4000);
    document.addEventListener('visibilitychange', save);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', save);
      save();
    };
  }, []);

  const week = useMemo(() => (index ? weeklyResult(index, game, month) : null), [index, game, month]);
  const sheetOpen = Boolean(selected || panel);
  const close = (): void => {
    setSelected(null);
    setPanel(null);
    setConfirmReset(false);
  };
  const top = useMemo(
    () =>
      [...fromBase.entries()]
        .sort((x, y) => y[1].air - x[1].air)
        .slice(0, 8)
        .map(([iata, d]) => ({ airport: index?.airports.get(iata), d })),
    [fromBase, index],
  );
  const freePlanes = game.fleet.filter((p) => !p.routeTo);
  const head = (title: string, sub: string): ReactNode => (
    <div className="head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <button className="x" onClick={close} aria-label="Zamknij">
        <CloseIcon />
      </button>
    </div>
  );

  /** Wiersz trasy na listach. */
  const routeRow = (r: Route, slot: number): ReactNode => {
    if (!index) return null;
    const dest = index.airports.get(r.to);
    const plane = game.fleet.find((p) => p.reg === r.planeReg);
    if (!dest || !plane) return null;
    const e = routeEconomics(index, game, r, month);
    const phase = flightPhase(r, e.km, aircraftType(plane.typeId), minuteOfDay, slot);
    return (
      <button key={r.to} onClick={() => setSelected(dest)}>
        <span className="code">{dest.iata}</span>
        <span className="nm">
          {cityOf(dest)}
          <small>{phaseText(phase, dest)}</small>
        </span>
        <b className={tone(e.profitWeekly)}>{signed(e.profitWeekly)}</b>
      </button>
    );
  };

  let sheet: ReactNode = null;
  if (selected && index && base) {
    const route = game.routes.find((r) => r.to === selected.iata);
    const sub = `${selected.iata} · ${selected.name} · ${COUNTRY.of(selected.country) ?? selected.country}`;
    const facts = (
      <>
        <div className="stats">
          <div>
            <b>{mln(selected.catchRaw)} mln</b>
            <span>ludzi w zasięgu</span>
          </div>
          <div>
            <b>{selected.wealth}</b>
            <span>zamożność (Unia = 100)</span>
          </div>
          <div>
            <b>{selected.runwayM ? `${num(selected.runwayM)} m` : '—'}</b>
            <span>najdłuższy pas</span>
          </div>
        </div>
        <p className="note">
          Turyści zagraniczni w okolicy: {num(selected.nights[6] ?? 0)} tys. noclegów w lipcu, {num(selected.nights[0] ?? 0)} tys. w styczniu
          {selected.nightsEstimated ? ' (szacunek)' : ''}.
        </p>
      </>
    );
    if (selected === base) {
      sheet = (
        <>
          {head(cityOf(base), `${sub} · Twoja baza`)}
          {game.routes.length ? (
            <div className="list">{game.routes.map(routeRow)}</div>
          ) : (
            <p className="note">Nie masz jeszcze tras. Włącz „Popyt”, żeby zobaczyć, dokąd ludzie chcą stąd latać, i dotknij lotniska na mapie.</p>
          )}
          {facts}
        </>
      );
    } else if (route) {
      const slot = game.routes.indexOf(route);
      const plane = game.fleet.find((p) => p.reg === route.planeReg);
      const type = aircraftType(plane?.typeId ?? 'AT76');
      const e = routeEconomics(index, game, route, month);
      const phase = flightPhase(route, e.km, type, minuteOfDay, slot);
      const max = maxRotations(e.km, type);
      const flying = phase.at === 'outbound' || phase.at === 'inbound';
      const leftCode = phase.at === 'inbound' || phase.at === 'destination' ? selected.iata : base.iata;
      const rightCode = leftCode === base.iata ? selected.iata : base.iata;
      const progress = flying ? phase.progress : 0;
      sheet = (
        <>
          {head(cityOf(selected), `${selected.iata} · ${num(e.km)} km · ${duration(e.flightMin)} lotu`)}
          <div className="prog">
            <b>{leftCode}</b>
            <div className="track">
              <i style={{ width: `${progress * 100}%` }} />
              <svg viewBox="0 0 24 24" style={{ left: `${progress * 100}%` }}>
                <path d="M12 1.5c.9 0 1.5 1 1.5 2.5v5l8 4.5v2l-8-2.3v5l2.3 1.7V22L12 21l-3.8 1v-2.1l2.3-1.7v-5l-8 2.3v-2l8-4.5V4c0-1.5.6-2.5 1.5-2.5z" />
              </svg>
            </div>
            <b>{rightCode}</b>
          </div>
          <p className="status">{phaseText(phase, selected)}</p>
          <div className="plane">
            <Art type={type} airline={game.airlineName} />
            <div>
              <b>
                {type.maker} {type.name}
              </b>
              <span>
                {plane?.reg} · {type.seats} miejsc
              </span>
            </div>
          </div>
          <div className="stats">
            <div>
              <b>{Math.round(e.load * 100)}%</b>
              <span>wypełnienie</span>
            </div>
            <div>
              <b>{num(e.passengers * 2)}</b>
              <span>pasażerów dziennie</span>
            </div>
            <div>
              <b className={tone(e.profitWeekly)}>{signed(e.profitWeekly)}</b>
              <span>zł tygodniowo</span>
            </div>
          </div>
          <p className="note">
            W {MONTHS[month]} chce tu lecieć {num(e.potential)} osób dziennie w jedną stronę.{' '}
            {e.unmet > 5 ? `${num(e.unmet)} chętnych dziennie zostaje na ziemi.` : e.load < 0.6 ? 'Samoloty latają w połowie puste.' : ''}
          </p>
          <div className="step">
            <label>Cena biletu</label>
            <button onClick={() => setGame((g) => changePrice(g, route.to, -0.05))} aria-label="Taniej">
              −
            </button>
            <output>{num(e.price)} zł</output>
            <button onClick={() => setGame((g) => changePrice(g, route.to, 0.05))} aria-label="Drożej">
              +
            </button>
          </div>
          <div className="step">
            <label>
              Loty dziennie <small>najwyżej {max}</small>
            </label>
            <button onClick={() => setGame((g) => changeRotations(index, g, route.to, -1))} aria-label="Mniej lotów">
              −
            </button>
            <output>{route.rotations}</output>
            <button onClick={() => setGame((g) => changeRotations(index, g, route.to, 1))} aria-label="Więcej lotów">
              +
            </button>
          </div>
          <button className="alt" onClick={() => setGame((g) => closeRoute(g, route.to))}>
            Zamknij trasę i zwolnij samolot
          </button>
        </>
      );
    } else {
      const d = fromBase.get(selected.iata);
      const check = canOpenRoute(index, game, selected.iata);
      const estType = check.ok ? check.type : (check.type ?? aircraftType(freePlanes[0]?.typeId ?? 'AT76'));
      const est = economics(index, game, selected.iata, estType, 1, 1, month);
      const realPax = real.get(selected.iata < base.iata ? `${selected.iata}-${base.iata}` : `${base.iata}-${selected.iata}`);
      sheet = (
        <>
          {head(cityOf(selected), sub)}
          {d && (
            <div className="box">
              <b className="t">
                Z bazy {cityOf(base)}: {num(d.air)} osób dziennie
              </b>
              Tyle chce lecieć w jedną stronę w {MONTHS[month]} ({num(d.distanceKm)} km). {d.landShare > 0.05 && <>Lądem pojedzie {Math.round(d.landShare * 100)}% podróżnych. </>}
              <div className="split">
                <span>
                  <b>{num(d.business)}</b> służbowo
                </span>
                <span>
                  <b>{num(d.tourism)}</b> turystyka
                </span>
                <span>
                  <b>{num(d.vfr)}</b> rodzina i praca
                </span>
              </div>
              <p className="real">
                {realPax
                  ? `Naprawdę w ${realRoutes?.year}: ${num(realPax / 730)} pasażerów dziennie w jedną stronę (Eurostat).`
                  : `Eurostat nie pokazuje regularnych lotów na tej trasie w ${realRoutes?.year ?? 'ostatnim'} roku.`}
              </p>
            </div>
          )}
          {check.ok ? (
            <>
              <p className="note">
                Jeden lot dziennie w obie strony ({check.type.maker} {check.type.name}, {check.type.seats} miejsc, bilet {num(typicalPrice(est.km))} zł){' '}
                {est.profitWeekly < 0 ? (
                  <>
                    przyniósłby <b className="neg">stratę około {num(-est.profitWeekly / 1000)} tys. zł</b>
                  </>
                ) : (
                  <>
                    dałby około <b className="pos">{num(est.profitWeekly / 1000)} tys. zł</b>
                  </>
                )}{' '}
                tygodniowo.
              </p>
              <button className="go" onClick={() => setGame((g) => openRoute(index, g, selected.iata))}>
                Otwórz trasę · {check.plane.reg}
              </button>
            </>
          ) : (
            <>
              <p className="note">
                {check.reason === 'no-free-plane' && 'Wszystkie samoloty latają. Żeby otworzyć tę trasę, potrzebujesz kolejnego.'}
                {check.reason === 'too-far' && `Za daleko dla wolnych samolotów (${num(est.km)} km). Potrzebny typ o większym zasięgu.`}
                {check.reason === 'runway-too-short' && `Pas tego lotniska (${num(selected.runwayM)} m) jest za krótki dla wolnych samolotów.`}
              </p>
              <button
                className="go"
                onClick={() => {
                  setSelected(null);
                  setFleetTab('market');
                  setPanel('fleet');
                }}
              >
                Zobacz rynek samolotów
              </button>
            </>
          )}
          {facts}
        </>
      );
    }
  } else if (panel === 'demand' && base) {
    sheet = (
      <>
        {head(`Popyt z bazy ${cityOf(base)}`, `Ilu ludzi dziennie chce lecieć w jedną stronę, w ${MONTHS[month]}`)}
        <p className="note legend">
          <i className="dot blue" /> poleci samolotem <i className="dot grey" /> pojedzie lądem. Liczby wynikają z ludności, zamożności, turystyki i powiązań między krajami.
        </p>
        <div className="list">
          {top.map(
            ({ airport, d }) =>
              airport && (
                <button key={airport.iata} onClick={() => setSelected(airport)}>
                  <span className="code">{airport.iata}</span>
                  <span className="nm">{cityOf(airport)}</span>
                  <b>{num(d.air)}</b>
                </button>
              ),
          )}
        </div>
      </>
    );
  } else if (panel === 'routes' && base) {
    sheet = (
      <>
        {head('Trasy', game.routes.length ? `${game.routes.length} z bazy ${cityOf(base)}` : 'Nie masz jeszcze tras')}
        {game.routes.length ? (
          <div className="list">{game.routes.map(routeRow)}</div>
        ) : (
          <p className="note">Włącz „Popyt”, żeby zobaczyć, dokąd ludzie chcą latać, i dotknij lotniska na mapie. Masz {freePlanes.length} wolny samolot.</p>
        )}
        {week && (
          <div className="sum t">
            <span>Wynik tygodnia po leasingu</span>
            <b className={tone(week.profit)}>{signed(week.profit)} zł</b>
          </div>
        )}
      </>
    );
  } else if (panel === 'fleet') {
    sheet = (
      <>
        {head('Flota', `${game.fleet.length} ${game.fleet.length === 1 ? 'samolot' : 'samolotów'}${freePlanes.length ? `, wolnych: ${freePlanes.length}` : ', wszystkie latają'}`)}
        <div className="seg">
          <button className={fleetTab === 'mine' ? 'on' : ''} onClick={() => setFleetTab('mine')}>
            Moje samoloty
          </button>
          <button className={fleetTab === 'market' ? 'on' : ''} onClick={() => setFleetTab('market')}>
            Rynek
          </button>
        </div>
        {fleetTab === 'mine'
          ? game.fleet.map((p) => {
              const type = aircraftType(p.typeId);
              const dest = p.routeTo ? index?.airports.get(p.routeTo) : null;
              return (
                <div className="card" key={p.reg}>
                  <Art type={type} airline={game.airlineName} />
                  <b>
                    {type.maker} {type.name}
                  </b>
                  <span>
                    {p.reg} · {type.seats} miejsc · rata {num(type.leaseWeekly / 1000)} tys. zł tygodniowo
                  </span>
                  <span>{dest && base ? `Lata na trasie ${cityOf(base)} – ${cityOf(dest)}` : 'Wolny, stoi w bazie'}</span>
                  {!p.routeTo && game.fleet.length > 1 && (
                    <button className="alt left" onClick={() => setGame((g) => returnPlane(g, p.reg))}>
                      Oddaj samolot
                    </button>
                  )}
                </div>
              );
            })
          : AIRCRAFT.map((type) => (
              <div className="card" key={type.id}>
                <Art type={type} airline={game.airlineName} />
                <small className="maker">{type.maker}</small>
                <b className="big">{type.name}</b>
                <div className="spec">
                  <div>
                    <b>{type.seats}</b>
                    <span>miejsc</span>
                  </div>
                  <div>
                    <b>{num(type.rangeKm)} km</b>
                    <span>zasięg</span>
                  </div>
                  <div>
                    <b>{type.speedKmh}</b>
                    <span>km/h</span>
                  </div>
                  <div>
                    <b>{num(type.runwayM)} m</b>
                    <span>pas</span>
                  </div>
                </div>
                <button
                  className="go"
                  onClick={() => {
                    setGame((g) => leasePlane(g, type.id));
                    setFleetTab('mine');
                  }}
                >
                  Leasing {num(type.leaseWeekly / 1000)} tys. zł / tydz.
                </button>
              </div>
            ))}
        {fleetTab === 'market' && <p className="note fine">Parametry przybliżone. Samolot trafia do bazy od razu, a rata wchodzi do wyniku tygodnia, także gdy samolot stoi.</p>}
      </>
    );
  } else if (panel === 'finance' && week) {
    const row = (label: string, value: string, cls = ''): ReactNode => (
      <div className="sum">
        <span>{label}</span>
        <b className={cls}>{value}</b>
      </div>
    );
    sheet = (
      <>
        {head('Finanse', `${game.airlineName} · w ${MONTHS[month]}`)}
        <div className="stats">
          <div>
            <b>{mln(game.cash)}</b>
            <span>mln zł na koncie</span>
          </div>
          <div>
            <b className={tone(week.profit)}>{signed(week.profit)}</b>
            <span>zł wynik tygodnia</span>
          </div>
          <div>
            <b>{game.routes.length}</b>
            <span>{game.routes.length === 1 ? 'trasa' : 'tras'}</span>
          </div>
        </div>
        {row('Bilety', `+${num(week.revenue / 1000)} tys. zł`, 'pos')}
        {row('Koszty lotów', `−${num(week.cost / 1000)} tys. zł`)}
        {row('Leasing floty', `−${num(week.lease / 1000)} tys. zł`)}
        <div className="sum t">
          <span>Wynik tygodnia</span>
          <b className={tone(week.profit)}>{signed(week.profit)} zł</b>
        </div>
        <button
          className="alt"
          onClick={() => {
            if (!confirmReset) return setConfirmReset(true);
            const fresh = freshGame();
            minutesRef.current = 0;
            if (clockRef.current) clockRef.current.minutes = 0;
            setGame(fresh);
            setConfirmReset(false);
            setDemandOn(false);
            close();
          }}
        >
          {confirmReset ? 'Na pewno? Dotknij jeszcze raz, żeby zacząć od nowa' : 'Zacznij grę od nowa'}
        </button>
      </>
    );
  } else if (panel === 'brand') {
    sheet = (
      <>
        {head('Marka', 'Jeszcze w budowie')}
        <p className="note">Mapa pokaże, gdzie ludzie znają Twoją linię, a kampanie pozwolą to zmieniać. Dochodzi w fazie 5.</p>
      </>
    );
  }

  return (
    // Interfejs jest zawsze jasny. Ciemny wariant zostaje w stylach pod przyszłą opcję w ustawieniach.
    <div className="game" data-theme="light">
      <div ref={baseEl} className="layer" />
      <div ref={lightsEl} className="layer lights" />
      <div ref={mapEl} className="layer" />

      <header className="hud">
        <button className="pill glass" onClick={() => (setSelected(null), setPanel('finance'))} aria-label="Finanse">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M3.5 17 9.5 3h6L13 17z" fill="#fff" />
            </svg>
          </span>
          <span>
            <b className="title">{num(Math.round(game.cash / 100) * 100)} zł</b>
            <br />
            <span className="sub">
              {error ? 'Błąd danych' : week ? <>{game.airlineName} · <span className={tone(week.profit)}>{signed(week.profit)}</span></> : 'Wczytuję świat…'}
            </span>
          </span>
        </button>
        <button className="pill glass time" onClick={() => setSpeedIx((i) => (i + 1) % SPEEDS.length)} aria-label="Zmień tempo czasu">
          <span>
            <b className="clock">{date ? TIME.format(date) : '--:--'}</b>
            <br />
            <span className="sub">{date ? DAY.format(date) : ''}</span>
          </span>
          <span className="speed">{speed ? `${speed}×` : 'II'}</span>
        </button>
      </header>

      {error && <p className="error glass">Nie udało się wczytać danych świata: {error}</p>}

      <nav className={`dock glass${sheetOpen ? ' hide' : ''}`} aria-label="Menu gry">
        {PANELS.map((p) => (
          <button
            key={p.key}
            className={p.key === 'demand' && demandOn ? 'on' : ''}
            onClick={() => {
              setSelected(null);
              if (p.key === 'demand') {
                // Pierwsze dotknięcie włącza widok i pokazuje objaśnienie, kolejne go wyłącza.
                if (demandOn) setDemandOn(false);
                else {
                  setDemandOn(true);
                  setPanel('demand');
                }
              } else setPanel(p.key);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {p.icon}
            </svg>
            {p.label}
          </button>
        ))}
      </nav>

      <section className={`sheet glass${sheetOpen ? ' open' : ''}`} aria-hidden={!sheetOpen}>
        {sheet}
      </section>
    </div>
  );
}
