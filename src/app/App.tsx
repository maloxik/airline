import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Airport, GameClock, WorldData } from '../sim';
import { createWorldMap, type WorldMap } from './map';

const SPEEDS = [1, 4, 0] as const;
const COUNTRY = new Intl.DisplayNames(['pl'], { type: 'region' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

type PanelKey = 'routes' | 'fleet' | 'demand' | 'brand' | 'finance';

/** Dolne menu. Działy są już nazwane i ułożone jak w mockupie; ich zawartość dochodzi w kolejnych fazach. */
const PANELS: { key: PanelKey; label: string; title: string; soon: string; icon: ReactNode }[] = [
  {
    key: 'routes',
    label: 'Trasy',
    title: 'Trasy',
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
    title: 'Flota',
    soon: 'Twoje samoloty i rynek: prawdziwe typy, leasing, zakup, malowanie linii. Dochodzi w fazie 4.',
    icon: <path d="M12 2.5c.8 0 1.4 1 1.4 2.4v4.6l7.6 4.4v1.9l-7.6-2.2v4.8l2.2 1.6v1.5L12 20.6l-3.6.9V20l2.2-1.6v-4.8L3 15.8v-1.9l7.6-4.4V4.9c0-1.4.6-2.4 1.4-2.4z" />,
  },
  {
    key: 'demand',
    label: 'Popyt',
    title: 'Popyt',
    soon: 'Mapa pokaże, ilu ludzi dziennie chce latać z Twojej bazy do każdego lotniska i ilu woli pociąg albo samochód. Dochodzi w fazie 1, razem z prawdziwymi danymi o ludności.',
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
    title: 'Marka',
    soon: 'Mapa pokaże, gdzie ludzie znają Twoją linię, a kampanie pozwolą to zmieniać. Dochodzi w fazie 5.',
    icon: <path d="M4 10v4l3 .6V9.4zM7 9.4 17 5v14L7 14.6M17 9.2a3 3 0 0 1 0 5.6M9.6 15.8l1 3.7" />,
  },
  {
    key: 'finance',
    label: 'Finanse',
    title: 'Finanse',
    soon: 'Stan konta, przychody i koszty tygodnia, leasing floty. Dochodzi w fazie 2 i 3.',
    icon: <path d="M4 19V11M10 19V5M16 19v-6M21.5 19h-19" />,
  },
];

const CloseIcon = () => (
  <svg viewBox="0 0 13 13">
    <path d="M2 2l9 9M11 2l-9 9" />
  </svg>
);

export function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [speedIx, setSpeedIx] = useState(0);

  useEffect(() => {
    fetch('/data/world.json')
      .then((r) => (r.ok ? (r.json() as Promise<WorldData>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setWorld)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!world || !mapEl.current || !lightsEl.current) return;
    const clock: GameClock = { startIso: '2027-02-16T04:05:00Z', minutes: 0 };
    const m = createWorldMap({
      container: mapEl.current,
      lightsContainer: lightsEl.current,
      world,
      clock,
      onTick: (t) => setDate(t.date),
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
            <span className="sub">{world ? `${world.airports.length} lotnisk` : error ? 'Błąd danych' : 'Wczytuję świat…'}</span>
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
            onClick={() => {
              setSelected(null);
              setPanel(p.key);
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
                <h2>{selected.city || selected.name}</h2>
                <p>{selected.name}</p>
              </div>
              <button className="x" onClick={close} aria-label="Zamknij">
                <CloseIcon />
              </button>
            </div>
            <div className="stats">
              <div>
                <b>{selected.iata}</b>
                <span>kod IATA · {selected.icao}</span>
              </div>
              <div>
                <b>{selected.runwayM ? `${selected.runwayM.toLocaleString('pl-PL')} m` : '—'}</b>
                <span>najdłuższy pas</span>
              </div>
              <div>
                <b>{selected.elevationM.toLocaleString('pl-PL')} m</b>
                <span>nad poziomem morza</span>
              </div>
            </div>
            <p className="note">
              {COUNTRY.of(selected.country) ?? selected.country} · {selected.size === 'L' ? 'duże lotnisko' : 'średnie lotnisko'}. Przybliż mapę, żeby
              zobaczyć prawdziwy układ pasów i płyt.
            </p>
          </>
        )}
        {!selected && openPanel && (
          <>
            <div className="head">
              <div>
                <h2>{openPanel.title}</h2>
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
