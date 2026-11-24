import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { demand, indexWorld, type Airport, type Demand, type GameClock, type RealRoutes, type WorldData } from '../sim';
import { createWorldMap, type WorldMap } from './map';

const SPEEDS = [1, 4, 0] as const;
const COUNTRY = new Intl.DisplayNames(['pl'], { type: 'region' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });
const MONTHS = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];
const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');
const mln = (n: number): string => (n / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: n < 1e6 ? 2 : 1 });
const cityOf = (a: Airport): string => a.city || a.name;
/** Baza, dopóki nie ma jeszcze ekranu startu gry. */
const DEFAULT_BASE = 'KTW';

type PanelKey = 'routes' | 'fleet' | 'demand' | 'brand' | 'finance';

/** Dolne menu. Działy są nazwane i ułożone jak w mockupie; zawartość dochodzi w kolejnych fazach. */
const PANELS: { key: PanelKey; label: string; soon: string; icon: ReactNode }[] = [
  {
    key: 'routes',
    label: 'Trasy',
    soon: 'Lista Twoich tras z lotem na żywo, wypełnieniem i wynikiem tygodnia. Dochodzi w fazie 3 (pierwsza grywalna wersja).',
    icon: (
      <>
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <path d="M7 17c8-.5 3-10 10-10.5" />
      </>
    ),
  },
  {
    key: 'fleet',
    label: 'Flota',
    soon: 'Twoje samoloty i rynek: prawdziwe typy, leasing, zakup, malowanie linii. Dochodzi w fazie 4.',
    icon: <path d="M12 2.5c.8 0 1.4 1 1.4 2.4v4.6l7.6 4.4v1.9l-7.6-2.2v4.8l2.2 1.6v1.5L12 20.6l-3.6.9V20l2.2-1.6v-4.8L3 15.8v-1.9l7.6-4.4V4.9c0-1.4.6-2.4 1.4-2.4z" />,
  },
  {
    key: 'demand',
    label: 'Popyt',
    soon: '',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 3" />
      </>
    ),
  },
  {
    key: 'brand',
    label: 'Marka',
    soon: 'Mapa pokaże, gdzie ludzie znają Twoją linię, a kampanie pozwolą to zmieniać. Dochodzi w fazie 5.',
    icon: <path d="M4 10v4l3 .6V9.4zM7 9.4 17 5v14L7 14.6M17 9.2a3 3 0 0 1 0 5.6M9.6 15.8l1 3.7" />,
  },
  {
    key: 'finance',
    label: 'Finanse',
    soon: 'Stan konta, przychody i koszty tygodnia, leasing floty. Dochodzi w fazie 2 i 3.',
    icon: <path d="M4 19V11M10 19V5M16 19v-6M21.5 19h-19" />,
  },
];

const CloseIcon = () => (
  <svg viewBox="0 0 13 13">
    <path d="M2 2l9 9M11 2l-9 9" />
  </svg>
);

async function loadJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

export function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [realRoutes, setRealRoutes] = useState<RealRoutes | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [month, setMonth] = useState(1);
  const [speedIx, setSpeedIx] = useState(0);
  const [baseIata, setBaseIata] = useState(DEFAULT_BASE);
  const [demandOn, setDemandOn] = useState(false);

  useEffect(() => {
    loadJson<WorldData>('/data/world.json')
      .then(setWorld)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    loadJson<RealRoutes>('/data/real-routes.json')
      .then(setRealRoutes)
      .catch(() => setRealRoutes(null));
  }, []);

  const index = useMemo(() => (world ? indexWorld(world) : null), [world]);
  const base = index?.airports.get(baseIata) ?? null;
  const real = useMemo(() => new Map(realRoutes?.routes ?? []), [realRoutes]);

  /** Popyt z bazy do każdego lotniska w bieżącym miesiącu. */
  const fromBase = useMemo(() => {
    const out = new Map<string, Demand>();
    if (!index || !base) return out;
    for (const a of index.airports.values()) if (a !== base) out.set(a.iata, demand(index, base, a, month));
    return out;
  }, [index, base, month]);

  useEffect(() => {
    if (!world || !mapEl.current || !lightsEl.current) return;
    const clock: GameClock = { startIso: '2027-02-16T04:05:00Z', minutes: 0 };
    const m = createWorldMap({
      container: mapEl.current,
      lightsContainer: lightsEl.current,
      world,
      clock,
      onTick: (t) => {
        setDate(t.date);
        setMonth(t.month);
      },
      onSelect: (airport) => {
        setPanel(null);
        setSelected(airport);
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

  const speed = SPEEDS[speedIx] ?? 1;
  useEffect(() => {
    mapRef.current?.setSpeed(speed);
  }, [speed, world]);

  const openPanel = PANELS.find((p) => p.key === panel) ?? null;
  const sheetOpen = Boolean(selected || openPanel);
  const close = (): void => {
    setSelected(null);
    setPanel(null);
  };
  const top = useMemo(
    () =>
      [...fromBase.entries()]
        .sort((x, y) => y[1].air - x[1].air)
        .slice(0, 8)
        .map(([iata, d]) => ({ airport: index?.airports.get(iata), d })),
    [fromBase, index],
  );

  const toSelected = selected && base && selected !== base ? fromBase.get(selected.iata) : undefined;
  const realPax = selected && base ? real.get(selected.iata < base.iata ? `${selected.iata}-${base.iata}` : `${base.iata}-${selected.iata}`) : undefined;

  return (
    // Interfejs jest zawsze jasny. Ciemny wariant zostaje w stylach pod przyszłą opcję w ustawieniach.
    <div className="game" data-theme="light">
      <div ref={mapEl} className="layer" />
      <div ref={lightsEl} className="layer lights" />

      <header className="hud">
        <div className="pill glass">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M3.5 17 9.5 3h6L13 17z" fill="#fff" />
            </svg>
          </span>
          <span>
            <b className="title">Airline</b>
            <br />
            <span className="sub">{base ? `Baza: ${cityOf(base)}` : error ? 'Błąd danych' : 'Wczytuję świat…'}</span>
          </span>
        </div>
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
        {selected && (
          <>
            <div className="head">
              <div>
                <h2>{cityOf(selected)}</h2>
                <p>
                  {selected.iata} · {selected.name} · {COUNTRY.of(selected.country) ?? selected.country}
                </p>
              </div>
              <button className="x" onClick={close} aria-label="Zamknij">
                <CloseIcon />
              </button>
            </div>

            {toSelected && base && (
              <div className="box">
                <b className="t">
                  Z bazy {cityOf(base)}: {num(toSelected.air)} osób dziennie
                </b>
                Tyle chce lecieć w jedną stronę w {MONTHS[month]} ({num(toSelected.distanceKm)} km).{' '}
                {toSelected.landShare > 0.05 && <>Lądem pojedzie {Math.round(toSelected.landShare * 100)}% podróżnych. </>}
                <div className="split">
                  <span>
                    <b>{num(toSelected.business)}</b> służbowo
                  </span>
                  <span>
                    <b>{num(toSelected.tourism)}</b> turystyka
                  </span>
                  <span>
                    <b>{num(toSelected.vfr)}</b> rodzina i praca
                  </span>
                </div>
                {realPax ? (
                  <p className="real">
                    Naprawdę w {realRoutes?.year}: {num(realPax / 730)} pasażerów dziennie w jedną stronę ({num(realPax)} rocznie, Eurostat).
                  </p>
                ) : (
                  <p className="real">Eurostat nie pokazuje regularnych lotów na tej trasie w {realRoutes?.year ?? 'ostatnim'} roku.</p>
                )}
              </div>
            )}

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
              {selected.nightsEstimated ? ' (szacunek, brak danych Eurostatu)' : ''}.
            </p>
            {base && selected !== base && (
              <button
                className="go sec"
                onClick={() => {
                  setBaseIata(selected.iata);
                  setDemandOn(true);
                }}
              >
                Ustaw tu bazę
              </button>
            )}
            {base && selected === base && <p className="note base">To Twoja baza. Włącz „Popyt”, żeby zobaczyć, dokąd ludzie chcą stąd latać.</p>}
          </>
        )}

        {!selected && openPanel?.key === 'demand' && base && (
          <>
            <div className="head">
              <div>
                <h2>Popyt z bazy {cityOf(base)}</h2>
                <p>Ilu ludzi dziennie chce lecieć w jedną stronę, w {MONTHS[month]}</p>
              </div>
              <button className="x" onClick={close} aria-label="Zamknij">
                <CloseIcon />
              </button>
            </div>
            <p className="note legend">
              <i className="dot blue" /> poleci samolotem <i className="dot grey" /> pojedzie lądem. Liczby wynikają z ludności, zamożności, turystyki i
              powiązań między krajami.
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
        )}

        {!selected && openPanel && openPanel.key !== 'demand' && (
          <>
            <div className="head">
              <div>
                <h2>{openPanel.label}</h2>
                <p>Jeszcze w budowie</p>
              </div>
              <button className="x" onClick={close} aria-label="Zamknij">
                <CloseIcon />
              </button>
            </div>
            <p className="note">{openPanel.soon}</p>
          </>
        )}
      </section>
    </div>
  );
}
