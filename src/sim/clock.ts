/** Czas gry. Liczony w minutach UTC od początku rozgrywki; mapa i rozkład lotów czytają z niego to samo. */

export interface GameClock {
  /** Chwila rozpoczęcia gry w UTC, np. '2027-02-16T04:05:00Z'. */
  readonly startIso: string;
  /** Minuty gry, które upłynęły od startu. */
  minutes: number;
}

export const MINUTES_PER_DAY = 1440;

export function gameDate(clock: GameClock): Date {
  return new Date(Date.parse(clock.startIso) + clock.minutes * 60_000);
}

/** Godzina UTC jako liczba z ułamkiem, 0–24. */
export function utcHours(clock: GameClock): number {
  const d = gameDate(clock);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

/** Dzień roku, 1–366. */
export function dayOfYear(clock: GameClock): number {
  const d = gameDate(clock);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - startOfYear) / 86_400_000) + 1;
}

/** Przesuwa zegar o czas rzeczywisty. `dayLengthMs` mówi, ile trwa doba gry przy prędkości 1. */
export function advance(clock: GameClock, realMs: number, speed: number, dayLengthMs = 90_000): void {
  clock.minutes += (realMs * speed * MINUTES_PER_DAY) / dayLengthMs;
}
