import { useEffect, useRef, useState } from 'react';
import type { Airport, GameClock, WorldData } from '../sim';
import { createWorldMap, type TimeOfDay, type WorldMap } from './map';

const SPEEDS = [1, 4, 0] as const;
const COUNTRY = new Intl.DisplayNames(['pl'], { type: 'region' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

export function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [tod, setTod] = useState<TimeOfDay>('night');
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
      onTick: (t) => {
        setDate(t.date);
        setTod(t.timeOfDay);
      },
      onSelect: setSelected,
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

  return (
    <div className="game" data-tod={tod}>
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
            <span className="sub">{world ? `${world.airports.length} lotnisk · dane z ${world.builtAt}` : error ? 'Błąd danych' : 'Wczytuję świat…'}</span>
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

      <section className={`sheet glass${selected ? ' open' : ''}`} aria-hidden={!selected}>
        {selected && (
          <>
            <div className="head">
              <div>
                <h2>{selected.city || selected.name}</h2>
                <p>{selected.name}</p>
              </div>
              <button className="x" onClick={() => setSelected(null)} aria-label="Zamknij">
                <svg viewBox="0 0 13 13">
                  <path d="M2 2l9 9M11 2l-9 9" />
                </svg>
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
      </section>
    </div>
  );
}
