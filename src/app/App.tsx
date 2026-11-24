import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AIRCRAFT,
  CLASS_LABEL,
  RESALE_SHARE,
  acceptOffer,
  advanceGame,
  aircraftType,
  awarenessOf,
  buyPlane,
  campaignCost,
  canAcceptOffer,
  canOpenRoute,
  cargoTons,
  changePrice,
  changeRotations,
  closeRoute,
  demand,
  dismissReport,
  economics,
  flightPhase,
  indexWorld,
  isFree,
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
  swapPlane,
  takeLoan,
  typicalPrice,
  weeklyResult,
  type AircraftClass,
  type AircraftType,
  type Airport,
  type Demand,
  type FlightPhase,
  type GameClock,
  type GameState,
  type Offer,
  type RealRoutes,
  type Route,
  type WorldData,
  type WorldIndex,
} from '../sim';
import { aircraftSvg } from './aircraftArt';
import { createWorldMap, type FlightOnMap, type WorldMap } from './map';

const SPEEDS = [1, 4, 0] as const;
const SAVE_KEY = 'airline-save-v3';
/** Malowania linii do wyboru na starcie. */
const LIVERIES: [name: string, color: string][] = [
  ['Cynober', '#e0492f'],
  ['Szmaragd', '#12805c'],
  ['Kobalt', '#2a5bd7'],
  ['Grafit', '#3a3d46'],
];
/** Zasięg pierwszego samolotu (ATR 72-600): tyle sięgają pierwsze trasy. */
const FIRST_PLANE_RANGE_KM = 1400;
const START_ISO = '2027-02-16T04:05:00Z';
const LOAN_STEP = 500_000;
const COUNTRY = new Intl.DisplayNames(['pl'], { type: 'region' });
const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const MONTHS = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];
const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');
const mln = (n: number): string => (n / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: Math.abs(n) < 1e7 ? 2 : 1 });
const tys = (n: number): string => `${num(n / 1000)} tys. zł`;
const signed = (n: number): string => `${n < 0 ? '−' : '+'}${num(Math.abs(n) / 1000)} tys.`;
const tone = (n: number): string => (n < 0 ? 'neg' : 'pos');
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const hm = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const duration = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h ` : '') + `${Math.round(min % 60)} min`;
const cityOf = (a: Airport): string => a.city || a.name;
const planes = (n: number): string => (n === 1 ? 'samolot' : n < 5 ? 'samoloty' : 'samolotów');

type PanelKey = 'routes' | 'fleet' | 'jobs' | 'brand' | 'finance';
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
  { key: 'jobs', label: 'Zlecenia', icon: <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16zM3.5 8 12 12.5 20.5 8M12 12.5v8" /> },
  { key: 'brand', label: 'Marka', icon: <path d="M4 10v4l3 .6V9.4zM7 9.4 17 5v14L7 14.6M17 9.2a3 3 0 0 1 0 5.6M9.6 15.8l1 3.7" /> },
  { key: 'finance', label: 'Finanse', icon: <path d="M4 19V11M10 19V5M16 19v-6M21.5 19h-19" /> },
];

interface Save {
  v: 3;
  game: GameState;
  color: string;
}
function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    return s.v === 3 && s.game?.baseIata && Array.isArray(s.game.fleet) && Array.isArray(s.game.offers) ? s : null;
  } catch {
    return null;
  }
}
/** Stan-zaślepka na czas ekranu startu: gra jeszcze się nie toczy. */
const placeholderGame = (): GameState => newGame('KTW', 'Linia', 1);
/** title = ekran tytułowy, pick = wybór lotniska, name = nazwa i malowanie, play = gra. */
type Stage = 'title' | 'pick' | 'name' | 'play';

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
const offerAmount = (o: Offer): string => (o.kind === 'cargo' ? `${o.amount} t` : `${o.amount} osób`);

const CloseIcon = () => (
  <svg viewBox="0 0 13 13">
    <path d="M2 2l9 9M11 2l-9 9" />
  </svg>
);
const Art = ({ type, airline, color }: { type: AircraftType; airline: string; color: string }) => (
  <div className="art" dangerouslySetInnerHTML={{ __html: aircraftSvg(type, color, airline) }} />
);

export function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const baseEl = useRef<HTMLDivElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [realRoutes, setRealRoutes] = useState<RealRoutes | null | undefined>(undefined);
  const [error, setError] = useState('');
  const saved = useMemo(loadSave, []);
  const [game, setGame] = useState<GameState>(() => saved?.game ?? placeholderGame());
  const [color, setColor] = useState(saved?.color ?? LIVERIES[0]![1]);
  const [stage, setStage] = useState<Stage>(saved ? 'play' : 'title');
  const [pick, setPick] = useState<Airport | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const colorRef = useRef(color);
  colorRef.current = color;
  const [selected, setSelected] = useState<Airport | null>(null);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [fleetTab, setFleetTab] = useState<'mine' | 'market'>('mine');
  const [marketClass, setMarketClass] = useState<AircraftClass>('tp');
  const [swapping, setSwapping] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [month, setMonth] = useState(1);
  const [minuteOfDay, setMinuteOfDay] = useState(0);
  const [speedIx, setSpeedIx] = useState(0);
  const [view, setView] = useState<'none' | 'demand' | 'brand'>('none');
  const [confirmReset, setConfirmReset] = useState(false);

  const gameRef = useRef(game);
  gameRef.current = game;
  const indexRef = useRef<WorldIndex | null>(null);
  const clockRef = useRef<GameClock | null>(null);

  useEffect(() => {
    loadJson<WorldData>('/data/world.json')
      .then(setWorld)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    loadJson<RealRoutes>('/data/real-routes.json')
      .then(setRealRoutes)
      .catch(() => setRealRoutes(null));
  }, []);

  // Indeks świata powstaje, gdy są lotniska i wiadomo już, czy jest prawdziwy ruch (konkurencja na trasach).
  const index = useMemo(() => (world && realRoutes !== undefined ? indexWorld(world, realRoutes) : null), [world, realRoutes]);
  indexRef.current = index;
  const base = (stage === 'play' && index?.airports.get(game.baseIata)) || null;

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
    const clock: GameClock = { startIso: START_ISO, minutes: gameRef.current.minutes };
    clockRef.current = clock;
    const m = createWorldMap({
      container: mapEl.current,
      baseContainer: baseEl.current,
      lightsContainer: lightsEl.current,
      world,
      clock,
      color: colorRef.current,
      onTick: (t) => {
        setDate(t.date);
        setMonth(t.month);
        setMinuteOfDay(t.minuteOfDay);
        const ix = indexRef.current;
        if (ix && stageRef.current === 'play') setGame((g) => advanceGame(ix, g, t.month, t.minutes - g.minutes));
      },
      onSelect: (airport) => {
        if (stageRef.current === 'pick') return void setPick(airport);
        if (stageRef.current !== 'play') return;
        setPanel(null);
        setSwapping(false);
        setSelected(airport);
      },
      getFlights: (mod) => {
        const ix = indexRef.current;
        const g = gameRef.current;
        const home = ix?.airports.get(g.baseIata);
        if (!ix || !home || stageRef.current !== 'play') return [];
        const here: [number, number] = [home.lng, home.lat];
        const out: FlightOnMap[] = [];
        g.routes.forEach((r, slot) => {
          const dest = ix.airports.get(r.to);
          const plane = g.fleet.find((p) => p.reg === r.planeReg);
          if (!dest || !plane) return;
          const type = aircraftType(plane.typeId);
          const phase = flightPhase(r, routeKm(ix, g, r.to), type, mod, slot);
          if (phase.at === 'outbound') out.push({ from: here, to: [dest.lng, dest.lat], progress: phase.progress, kind: type.kind });
          else if (phase.at === 'inbound') out.push({ from: [dest.lng, dest.lat], to: here, progress: phase.progress, kind: type.kind });
        });
        for (const p of g.fleet) {
          const dest = p.job && ix.airports.get(p.job.to);
          if (!p.job || !dest) continue;
          const phase = jobPhase(p.job, clock.minutes);
          const kind = aircraftType(p.typeId).kind;
          if (phase.at === 'outbound') out.push({ from: here, to: [dest.lng, dest.lat], progress: phase.progress, kind, job: true });
          else if (phase.at === 'inbound') out.push({ from: [dest.lng, dest.lat], to: here, progress: phase.progress, kind, job: true });
        }
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
    mapRef.current?.select(stage === 'play' ? selected : pick);
  }, [selected, pick, stage]);
  useEffect(() => {
    mapRef.current?.setColor(color);
  }, [color, world]);
  // Kamera na ekranach startu: powolny przelot nad Europą, potem widok do wyboru lotniska.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !world) return;
    if (stage === 'title') {
      m.moveCamera({ center: [4, 49], zoom: 3.7, durationMs: 0 });
      m.moveCamera({ center: [20, 50.5], zoom: 3.7, durationMs: 80_000, linear: true });
    } else if (stage === 'pick' && !pick) m.moveCamera({ center: [13, 50.5], zoom: 3.3, durationMs: 1200 });
    else if (stage === 'pick' && pick) m.moveCamera({ center: [pick.lng, pick.lat], zoom: 4.4, durationMs: 800, offsetY: -250 });
  }, [stage, pick, world]);
  useEffect(() => {
    mapRef.current?.setDemand(view === 'demand' && base ? { base, values: fromBase } : null);
  }, [view, base, fromBase, world]);
  const servedKey = game.routes.map((r) => r.to).join(',');
  useEffect(() => {
    if (!index) return;
    const served = game.routes.map((r) => index.airports.get(r.to)).filter((a): a is Airport => Boolean(a));
    mapRef.current?.setNetwork(base, served);
  }, [servedKey, base, index]);
  // Znajomość marki na mapie: baza, miasta z trasami i te, w których była kampania.
  const brandKey = view === 'brand' ? `${servedKey}|${Object.entries(game.awareness).map(([k, v]) => `${k}${Math.round(v * 20)}`).join()}` : '';
  useEffect(() => {
    if (!index || view !== 'brand') return void mapRef.current?.setBrand(null);
    const g = gameRef.current;
    const codes = new Set([g.baseIata, ...g.routes.map((r) => r.to), ...Object.keys(g.awareness)]);
    mapRef.current?.setBrand(new Map([...codes].map((c) => [c, awarenessOf(index, g, c)])));
  }, [brandKey, view, index]);
  const speed = game.bankrupt || stage !== 'play' ? 0 : (SPEEDS[speedIx] ?? 1);
  useEffect(() => {
    mapRef.current?.setSpeed(speed);
  }, [speed, world]);

  // Zapis gry: co kilka sekund i przy schowaniu aplikacji.
  useEffect(() => {
    const save = (): void => {
      if (stageRef.current !== 'play') return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, game: gameRef.current, color: colorRef.current } satisfies Save));
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
  // Zegar pokazuje czas lokalny bazy, liczony z jej długości geograficznej.
  const localDate = date && base ? new Date(date.getTime() + Math.round(base.lng / 15) * 3_600_000) : date;
  const level = levelOf(week?.revenue ?? 0);
  const showReport = Boolean(game.report) && !selected && !panel && !game.bankrupt;
  const showReport0 = showReport && stage === 'play';
  const sheetOpen = stage === 'play' ? Boolean(selected || panel || showReport0 || game.bankrupt) : stage === 'name' || (stage === 'pick' && Boolean(pick));
  const close = (): void => {
    setSelected(null);
    setPanel(null);
    setSwapping(false);
    setConfirmReset(false);
  };
  /** Wraca do ekranu tytułowego i kasuje zapis. */
  const restart = (): void => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nic: zapis i tak zostanie nadpisany nową grą */
    }
    if (clockRef.current) clockRef.current.minutes = 0;
    setGame(placeholderGame());
    setView('none');
    setPick(null);
    close();
    setStage('title');
  };
  const begin = (): void => {
    if (!pick) return;
    const name = nameDraft.trim() || `${cityOf(pick)} Air`;
    if (clockRef.current) clockRef.current.minutes = 0;
    setGame(newGame(pick.iata, name, Math.floor(Math.random() * 1e9)));
    setStage('play');
    setView('demand');
    close();
    mapRef.current?.moveCamera({ center: [pick.lng, pick.lat], zoom: 4.3, durationMs: 1500 });
    setPick(null);
  };
  /** Najmocniejsze kierunki z lotniska oglądanego przy wyborze bazy, w zasięgu pierwszego samolotu. */
  const pickTop = useMemo(() => {
    if (!pick || !index) return [];
    return [...index.airports.values()]
      .filter((a) => a !== pick)
      .map((a) => ({ a, d: demand(index, pick, a, month) }))
      .filter((o) => o.d.distanceKm <= FIRST_PLANE_RANGE_KM)
      .sort((x, y) => y.d.air - x.d.air)
      .slice(0, 4);
  }, [pick, index, month]);
  const pickRivalRoutes = useMemo(() => {
    if (!pick || !index) return 0;
    let n = 0;
    for (const key of index.realTraffic.keys()) if (key.startsWith(`${pick.iata}-`) || key.endsWith(`-${pick.iata}`)) n++;
    return n;
  }, [pick, index]);
  const top = useMemo(
    () =>
      [...fromBase.entries()]
        .sort((x, y) => y[1].air - x[1].air)
        .slice(0, 8)
        .map(([iata, d]) => ({ airport: index?.airports.get(iata), d })),
    [fromBase, index],
  );
  const freePlanes = game.fleet.filter(isFree);
  const head = (title: string, sub: string, closable = true): ReactNode => (
    <div className="head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {closable && (
        <button className="x" onClick={close} aria-label="Zamknij">
          <CloseIcon />
        </button>
      )}
    </div>
  );
  const campaignButton = (a: Airport): ReactNode => {
    if (!index || awarenessOf(index, game, a.iata) >= 0.99) return null;
    const cost = campaignCost(index, a.iata);
    return (
      <button className="go sec" disabled={game.cash < cost} onClick={() => setGame((g) => runCampaign(index, g, a.iata))}>
        Kampania w mieście · {tys(cost)}
      </button>
    );
  };

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
  if (stage === 'pick' && pick) {
    const verdict =
      pickRivalRoutes > 80
        ? ['Trudny start', 'Wielki port: silni rywale latają stąd prawie wszędzie.']
        : pickRivalRoutes > 20
          ? ['Wymagający start', 'Spore lotnisko. Ludzi dużo, ale konkurencja już tu jest.']
          : ['Dobry start', 'Małe lotnisko i dużo wolnego pola.'];
    sheet = (
      <>
        <div className="head">
          <div>
            <h2>{cityOf(pick)}</h2>
            <p>
              {pick.iata} · {pick.name} · {COUNTRY.of(pick.country) ?? pick.country}
            </p>
          </div>
          <button className="x" onClick={() => setPick(null)} aria-label="Zamknij">
            <CloseIcon />
          </button>
        </div>
        <div className="stats">
          <div>
            <b>{mln(pick.catchRaw)} mln</b>
            <span>ludzi w zasięgu</span>
          </div>
          <div>
            <b>{pick.wealth}</b>
            <span>zamożność (Unia = 100)</span>
          </div>
          <div>
            <b>{pickRivalRoutes}</b>
            <span>tras innych linii</span>
          </div>
        </div>
        <div className="box">
          <b className="t">{verdict[0]}</b>
          {verdict[1]}
        </div>
        <p className="note legend">Dokąd ludzie chcą stąd latać (w zasięgu pierwszego samolotu):</p>
        {pickTop.map(({ a, d }) => (
          <div className="sum" key={a.iata}>
            <span>{cityOf(a)}</span>
            <b>{num(d.air)} dziennie</b>
          </div>
        ))}
        <button
          className="go"
          onClick={() => {
            setNameDraft(`${cityOf(pick)} Air`);
            setStage('name');
          }}
        >
          Zacznij tutaj
        </button>
      </>
    );
  } else if (stage === 'name' && pick) {
    sheet = (
      <>
        <div className="head">
          <div>
            <h2>Twoja linia</h2>
            <p>
              Baza: {cityOf(pick)} ({pick.iata})
            </p>
          </div>
          <button className="x" onClick={() => setStage('pick')} aria-label="Wróć">
            <CloseIcon />
          </button>
        </div>
        <input className="field" maxLength={18} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} aria-label="Nazwa linii" />
        <div className="liv">
          Malowanie
          {LIVERIES.map(([label, c]) => (
            <button key={c} title={label} aria-label={label} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="card">
          <Art type={aircraftType('AT76')} airline={nameDraft.trim() || 'Linia'} color={color} />
          <b>ATR 72-600</b>
          <span>Twój pierwszy samolot: 72 miejsca, zasięg 1400 km, w leasingu.</span>
        </div>
        <p className="note">Na start dostajesz też 3 mln zł. Reszta zależy od tego, dokąd polecisz.</p>
        <button className="go" onClick={begin}>
          Startuj
        </button>
      </>
    );
  } else if (stage !== 'play') {
    sheet = null;
  } else if (game.bankrupt) {
    sheet = (
      <>
        {head('Bankructwo', `${game.airlineName} · dług przekroczył limit banku`, false)}
        <p className="note">
          Na koncie zostało {mln(game.cash)} mln zł. Bank wypowiedział umowy, samoloty wracają do leasingodawców. Linia przetrwała {Math.floor(game.minutes / 10080)} tygodni.
        </p>
        <button className="go" onClick={restart}>
          Zacznij od nowa
        </button>
      </>
    );
  } else if (selected && index && base) {
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
            <p className="note">Nie masz jeszcze tras. Włącz „Popyt” w lewym górnym rogu, żeby zobaczyć, dokąd ludzie chcą stąd latać, i dotknij lotniska na mapie.</p>
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
      const candidates = freePlanes.filter((p) => {
        const t = aircraftType(p.typeId);
        return t.rangeKm >= e.km && (!selected.runwayM || selected.runwayM >= t.runwayM);
      });
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
            <Art type={type} airline={game.airlineName} color={color} />
            <div>
              <b>
                {type.maker} {type.name}
              </b>
              <span>
                {plane?.reg} · {type.seats} miejsc
              </span>
            </div>
          </div>
          {swapping ? (
            <div className="list">
              {candidates.map((p) => {
                const t = aircraftType(p.typeId);
                return (
                  <button
                    key={p.reg}
                    onClick={() => {
                      setGame((g) => swapPlane(index, g, route.to, p.reg));
                      setSwapping(false);
                    }}
                  >
                    <span className="code">{t.seats}</span>
                    <span className="nm">
                      {t.maker} {t.name}
                      <small>{p.reg} · wolny w bazie</small>
                    </span>
                    <b>Wybierz</b>
                  </button>
                );
              })}
            </div>
          ) : (
            candidates.length > 0 && (
              <button className="alt left" onClick={() => setSwapping(true)}>
                Zmień samolot na tej trasie
              </button>
            )
          )}
          <div className="stats">
            <div>
              <b>{pct(e.load)}</b>
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
            W {MONTHS[month]} cały rynek to {num(e.market)} osób dziennie w jedną stronę.{' '}
            {e.rivals > 0 ? `Inne linie przewożą tu ${num(e.rivals)} dziennie, Tobie przypada ${pct(e.share)} rynku. ` : 'Nikt inny tu nie lata. '}
            Twoją linię zna tu {pct(e.awareness)} ludzi. {e.unmet > 5 ? `${num(e.unmet)} chętnych dziennie zostaje na ziemi.` : e.load < 0.6 ? 'Samoloty latają w połowie puste.' : ''}
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
          {campaignButton(selected)}
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
      sheet = (
        <>
          {head(cityOf(selected), sub)}
          {d && (
            <div className="box">
              <b className="t">
                Z bazy {cityOf(base)}: {num(d.air)} osób dziennie
              </b>
              Tyle chce lecieć w jedną stronę w {MONTHS[month]} ({num(d.distanceKm)} km). {d.landShare > 0.05 && <>Lądem pojedzie {pct(d.landShare)} podróżnych. </>}
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
                {est.rivals > 0
                  ? `Konkurencja: inne linie przewożą tu ${num(est.rivals)} pasażerów dziennie w jedną stronę (Eurostat ${realRoutes?.year}). Na start przypadnie Ci ${pct(est.share)} rynku.`
                  : 'Konkurencja: nikt nie lata regularnie na tej trasie. Cały rynek jest Twój.'}{' '}
                Twoją linię zna tu {pct(est.awareness)} ludzi.
              </p>
            </div>
          )}
          {check.ok ? (
            <>
              <p className="note">
                Jeden lot dziennie w obie strony ({check.type.maker} {check.type.name}, {check.type.seats} miejsc, bilet {num(typicalPrice(est.km))} zł) zabierze {num(est.passengers)} osób i{' '}
                {est.profitWeekly < 0 ? (
                  <>
                    przyniesie <b className="neg">stratę około {num(-est.profitWeekly / 1000)} tys. zł</b>
                  </>
                ) : (
                  <>
                    da około <b className="pos">{num(est.profitWeekly / 1000)} tys. zł</b>
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
                {check.reason === 'no-free-plane' && 'Wszystkie samoloty są zajęte. Żeby otworzyć tę trasę, potrzebujesz kolejnego.'}
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
          {campaignButton(selected)}
          {facts}
        </>
      );
    }
  } else if (showReport0 && game.report && index) {
    const r = game.report;
    const name = (to: string): string => {
      const a = index.airports.get(to);
      return a ? cityOf(a) : to;
    };
    sheet = (
      <>
        {head(`Tydzień ${r.week}`, `${game.airlineName} · ${level.name}`, false)}
        <div className="stats">
          <div>
            <b className={tone(r.profit)}>{signed(r.profit)}</b>
            <span>zł wynik tygodnia</span>
          </div>
          <div>
            <b>{mln(r.cash)}</b>
            <span>mln zł na koncie</span>
          </div>
          <div>
            <b>{game.routes.length}</b>
            <span>tras · {game.fleet.length} {planes(game.fleet.length)}</span>
          </div>
        </div>
        {r.best && (
          <div className="sum">
            <span>Najlepsza trasa: {name(r.best.to)}</span>
            <b className={tone(r.best.profit)}>{signed(r.best.profit)}</b>
          </div>
        )}
        {r.worst && (
          <div className="sum">
            <span>Najsłabsza trasa: {name(r.worst.to)}</span>
            <b className={tone(r.worst.profit)}>{signed(r.worst.profit)}</b>
          </div>
        )}
        {!r.best && <p className="note">Nie masz jeszcze żadnej trasy. Samolot w leasingu kosztuje ratę nawet wtedy, gdy stoi.</p>}
        <button className="go" onClick={() => setGame(dismissReport)}>
          Dalej
        </button>
      </>
    );
  } else if (panel === 'routes' && base) {
    sheet = (
      <>
        {head('Trasy', game.routes.length ? `${game.routes.length} z bazy ${cityOf(base)}` : 'Nie masz jeszcze tras')}
        {game.routes.length ? (
          <div className="list">{game.routes.map(routeRow)}</div>
        ) : (
          <p className="note">Włącz „Popyt” w lewym górnym rogu, żeby zobaczyć, dokąd ludzie chcą latać, i dotknij lotniska na mapie.</p>
        )}
        <p className="note legend">Najmocniejsze kierunki w {MONTHS[month]}:</p>
        <div className="list">
          {top.slice(0, 5).map(
            ({ airport, d }) =>
              airport && (
                <button key={airport.iata} onClick={() => setSelected(airport)}>
                  <span className="code">{airport.iata}</span>
                  <span className="nm">{cityOf(airport)}</span>
                  <b>{num(d.air)} dziennie</b>
                </button>
              ),
          )}
        </div>
      </>
    );
  } else if (panel === 'fleet') {
    sheet = (
      <>
        {head('Flota', `${game.fleet.length} ${planes(game.fleet.length)}${freePlanes.length ? `, wolnych: ${freePlanes.length}` : ', wszystkie zajęte'}`)}
        <div className="seg">
          <button className={fleetTab === 'mine' ? 'on' : ''} onClick={() => setFleetTab('mine')}>
            Moje samoloty
          </button>
          <button className={fleetTab === 'market' ? 'on' : ''} onClick={() => setFleetTab('market')}>
            Rynek
          </button>
        </div>
        {fleetTab === 'mine' ? (
          game.fleet.map((p) => {
            const type = aircraftType(p.typeId);
            const dest = index?.airports.get(p.routeTo ?? p.job?.to ?? '');
            return (
              <div className="card" key={p.reg}>
                <Art type={type} airline={game.airlineName} color={color} />
                <b>
                  {type.maker} {type.name}
                </b>
                <span>
                  {p.reg} · {type.seats} miejsc · {p.owned ? 'własny' : `leasing ${tys(type.leaseWeekly)} tygodniowo`}
                </span>
                <span>
                  {p.job && dest ? `Zlecenie: ${p.job.what}, ${cityOf(dest)}` : p.routeTo && dest && base ? `Trasa ${cityOf(base)} – ${cityOf(dest)}` : 'Wolny, stoi w bazie'}
                </span>
                {isFree(p) && game.fleet.length > 1 && (
                  <button className="alt left" onClick={() => setGame((g) => returnPlane(g, p.reg))}>
                    {p.owned ? `Sprzedaj za ${tys(type.price * RESALE_SHARE)}` : 'Oddaj leasingodawcy'}
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <>
            <div className="chips">
              {(Object.keys(CLASS_LABEL) as AircraftClass[]).map((c) => (
                <button key={c} className={marketClass === c ? 'on' : ''} onClick={() => setMarketClass(c)}>
                  {CLASS_LABEL[c]}
                </button>
              ))}
            </div>
            {AIRCRAFT.filter((t) => t.cls === marketClass).map((type) => (
              <div className="card" key={type.id}>
                <Art type={type} airline={game.airlineName} color={color} />
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
                    <b>{cargoTons(type)} t</b>
                    <span>ładunku</span>
                  </div>
                  <div>
                    <b>{num(type.runwayM)} m</b>
                    <span>pas</span>
                  </div>
                </div>
                <div className="pair">
                  <button
                    className="go"
                    onClick={() => {
                      setGame((g) => leasePlane(g, type.id));
                      setFleetTab('mine');
                    }}
                  >
                    Leasing
                    <small>{tys(type.leaseWeekly)} / tydz.</small>
                  </button>
                  <button
                    className="go sec"
                    disabled={game.cash < type.price}
                    onClick={() => {
                      setGame((g) => buyPlane(g, type.id));
                      setFleetTab('mine');
                    }}
                  >
                    Kup
                    <small>{mln(type.price)} mln zł</small>
                  </button>
                </div>
              </div>
            ))}
            <p className="note fine">Parametry techniczne przybliżone. Ceny i raty są w skali gry, nie z cenników producentów. Samolot trafia do bazy od razu.</p>
          </>
        )}
      </>
    );
  } else if (panel === 'jobs' && index) {
    const active = game.fleet.filter((p) => p.job);
    const why = { 'no-free-plane': 'Brak wolnego samolotu', 'too-small': 'Za mały samolot', 'too-far': 'Za daleko dla Twojej floty', 'runway-too-short': 'Za krótki pas u celu' } as const;
    sheet = (
      <>
        {head('Zlecenia', 'Ładunki i czartery dla wolnych samolotów')}
        {active.map((p) => {
          const dest = index.airports.get(p.job!.to);
          const left = p.job!.endMin - game.minutes;
          return (
            <div className="box" key={p.reg}>
              <b className="t">
                W trakcie: {p.job!.what}, {dest ? cityOf(dest) : p.job!.to}
              </b>
              {p.reg} wróci za {duration(Math.max(0, left))}. Zapłata po powrocie: {tys(p.job!.reward)}.
            </div>
          );
        })}
        {game.offers.length === 0 && <p className="note">Teraz nie ma ofert. Nowe pojawiają się codziennie.</p>}
        {game.offers.map((o) => {
          const dest = index.airports.get(o.to);
          const check = canAcceptOffer(index, game, o);
          const km = routeKm(index, game, o.to);
          return (
            <div className="card job" key={o.id}>
              <small className="maker">{o.kind === 'cargo' ? 'Ładunek' : 'Czarter'}</small>
              <b className="big">
                {o.what}, {offerAmount(o)}
              </b>
              <span>
                Do: {dest ? cityOf(dest) : o.to} ({o.to}) · {num(km)} km · oferta ważna jeszcze {duration(o.expiresMin - game.minutes)}
              </span>
              <span>
                Zapłata {tys(o.reward)}
                {check.ok && (
                  <>
                    , koszt lotu {tys(check.cost)}, zostaje <b className={tone(o.reward - check.cost)}>{tys(o.reward - check.cost)}</b>
                  </>
                )}
              </span>
              {check.ok ? (
                <button className="go" onClick={() => setGame((g) => acceptOffer(index, g, o.id))}>
                  Przyjmij · {check.plane.reg} ({check.type.name}), {duration(check.durationMin)}
                </button>
              ) : (
                <button className="go sec" disabled>
                  {why[check.reason]}
                </button>
              )}
            </div>
          );
        })}
      </>
    );
  } else if (panel === 'brand' && index && base) {
    const cities = [...new Set([...game.routes.map((r) => r.to), ...Object.keys(game.awareness)])].map((c) => index.airports.get(c)).filter((a): a is Airport => Boolean(a));
    sheet = (
      <>
        {head('Marka', 'Gdzie ludzie znają Twoją linię')}
        <p className="note">
          W mieście, które nie zna Twojej linii, poleci z Tobą tylko część chętnych. Znajomość rośnie sama tam, gdzie latasz. Kampania podnosi ją od razu o 35 punktów.
        </p>
        <button className={`go${view === 'brand' ? ' sec' : ''}`} onClick={() => setView((v) => (v === 'brand' ? 'none' : 'brand'))}>
          {view === 'brand' ? 'Ukryj markę na mapie' : 'Pokaż markę na mapie'}
        </button>
        <div className="list">
          {cities.map((a) => {
            const aw = awarenessOf(index, game, a.iata);
            const cost = campaignCost(index, a.iata);
            return (
              <button key={a.iata} disabled={aw >= 0.99 || game.cash < cost} onClick={() => setGame((g) => runCampaign(index, g, a.iata))}>
                <span className="code">{pct(aw)}</span>
                <span className="nm">
                  {cityOf(a)}
                  <small>{aw >= 0.99 ? 'Znają Cię wszyscy' : `Kampania: ${tys(cost)}`}</small>
                </span>
                {aw < 0.99 && <b>Reklamuj</b>}
              </button>
            );
          })}
        </div>
        {cities.length === 0 && <p className="note">Kampanię zamówisz z karty dowolnego lotniska: dotknij go na mapie.</p>}
      </>
    );
  } else if (panel === 'finance' && week && index) {
    const limit = loanLimit(index, game, month);
    const row = (label: string, value: string, cls = ''): ReactNode => (
      <div className="sum">
        <span>{label}</span>
        <b className={cls}>{value}</b>
      </div>
    );
    sheet = (
      <>
        {head('Finanse', `${game.airlineName} · ${level.name}`)}
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
            <b>{mln(game.loan)}</b>
            <span>mln zł kredytu</span>
          </div>
        </div>
        {level.next && (
          <p className="note">
            Następny poziom: {level.next.name}, przy sprzedaży biletów {tys(level.next.revenue)} tygodniowo (teraz {tys(week.revenue)}).
          </p>
        )}
        {row('Bilety', `+${tys(week.revenue)}`, 'pos')}
        {row('Koszty lotów', `−${tys(week.cost)}`)}
        {row('Leasing floty', `−${tys(week.lease)}`)}
        {row('Odsetki od kredytu', `−${tys(week.interest)}`)}
        {row('Zlecenia w tym tygodniu', `+${tys(game.jobIncomeWeek)}`, game.jobIncomeWeek > 0 ? 'pos' : '')}
        <div className="sum t">
          <span>Wynik tygodnia z tras</span>
          <b className={tone(week.profit)}>{signed(week.profit)} zł</b>
        </div>
        <div className="pair">
          <button className="go sec" disabled={game.loan >= limit} onClick={() => setGame((g) => takeLoan(index, g, month, LOAN_STEP))}>
            Weź kredyt
            <small>+500 tys. zł, limit {mln(limit)} mln</small>
          </button>
          <button className="go sec" disabled={game.loan <= 0 || game.cash <= 0} onClick={() => setGame((g) => repayLoan(g, LOAN_STEP))}>
            Spłać
            <small>−500 tys. zł</small>
          </button>
        </div>
        <button className="alt" onClick={() => (confirmReset ? restart() : setConfirmReset(true))}>
          {confirmReset ? 'Na pewno? Dotknij jeszcze raz, żeby zacząć od nowa' : 'Zacznij grę od nowa'}
        </button>
      </>
    );
  }

  return (
    // Interfejs jest zawsze jasny. Ciemny wariant zostaje w stylach pod przyszłą opcję w ustawieniach.
    <div className={`game stage-${stage}`} data-theme="light" style={{ '--brand': color } as CSSProperties}>
      <div ref={baseEl} className="layer" />
      <div ref={lightsEl} className="layer lights" />
      <div ref={mapEl} className="layer" />

      <header className="hud">
        <div className="left">
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
                {error ? (
                  'Błąd danych'
                ) : week ? (
                  <>
                    {game.airlineName} · <span className={tone(week.profit)}>{signed(week.profit)}</span>
                  </>
                ) : (
                  'Wczytuję świat…'
                )}
              </span>
            </span>
          </button>
          <button className={`chip glass${view === 'demand' ? ' on' : ''}`} onClick={() => setView((v) => (v === 'demand' ? 'none' : 'demand'))}>
            Popyt
          </button>
        </div>
        <button className="pill glass time" onClick={() => setSpeedIx((i) => (i + 1) % SPEEDS.length)} aria-label="Zmień tempo czasu">
          <span>
            <b className="clock">{date ? hm(minuteOfDay) : '--:--'}</b>
            <br />
            <span className="sub">{localDate ? DAY.format(localDate) : ''}</span>
          </span>
          <span className="speed">{speed ? `${speed}×` : 'II'}</span>
        </button>
      </header>

      {error && <p className="error glass">Nie udało się wczytać danych świata: {error}</p>}

      {stage === 'pick' && <p className="pickbar glass">Wybierz lotnisko, z którego zaczniesz</p>}
      <div className={`intro${stage === 'title' ? '' : ' off'}`}>
        <small>Nazwa robocza</small>
        <h1>Airline</h1>
        <p>Załóż linię lotniczą na prawdziwej mapie. Światła pokazują, gdzie naprawdę mieszkają ludzie.</p>
        <button className="go" onClick={() => setStage('pick')}>
          Nowa linia
        </button>
      </div>

      <nav className={`dock glass${sheetOpen ? ' hide' : ''}`} aria-label="Menu gry">
        {PANELS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setSelected(null);
              setPanel(p.key);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {p.icon}
            </svg>
            {p.label}
            {p.key === 'jobs' && game.offers.length > 0 && <i className="badge">{game.offers.length}</i>}
          </button>
        ))}
      </nav>

      <section className={`sheet glass${sheetOpen ? ' open' : ''}`} aria-hidden={!sheetOpen}>
        {sheet}
      </section>
    </div>
  );
}
