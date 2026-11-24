// Dopasowuje model popytu do prawdziwego ruchu między lotniskami (Eurostat) i zapisuje:
//   src/sim/demand-params.json   dopasowane parametry, których używa gra
//   docs/KALIBRACJA.md           raport: jak blisko rzeczywistości jest model i gdzie się myli
// Uruchamiane ręcznie: `npm run calibrate` (po `npm run data`).
import { readFileSync, writeFileSync } from 'node:fs';
import { indexWorld, yearlyAverageDemand, type DemandParams, type RealRoutes, type WorldData } from '../../src/sim/index';

const world = JSON.parse(readFileSync('public/data/world.json', 'utf8')) as WorldData;
const real = JSON.parse(readFileSync('public/data/real-routes.json', 'utf8')) as RealRoutes;
const index = indexWorld(world);

/** Prawdziwe trasy z ruchem co najmniej 20 tys. pasażerów rocznie, przeliczone na pasażerów dziennie w jedną stronę. */
const sample = real.routes
  .map(([key, pax]) => {
    const [x, y] = key.split('-');
    return { key, a: index.airports.get(x ?? ''), b: index.airports.get(y ?? ''), perDay: pax / 730 };
  })
  .filter((r) => r.a && r.b && r.perDay * 730 >= 20000) as { key: string; a: NonNullable<ReturnType<typeof index.airports.get>>; b: NonNullable<ReturnType<typeof index.airports.get>>; perDay: number }[];

// Trasy, których w danych nie ma. Między dobrze opisanymi lotniskami brak trasy znaczy, że nikt jej regularnie nie lata,
// więc model nie powinien tam widzieć dużego popytu. Bez tego dopasowanie do samych istniejących tras zawyża wszystko inne.
const routeCount = new Map<string, number>();
for (const [key] of real.routes) for (const code of key.split('-')) routeCount.set(code, (routeCount.get(code) ?? 0) + 1);
const covered = [...index.airports.values()].filter((a) => (routeCount.get(a.iata) ?? 0) >= 15);
const known = new Set(real.routes.map(([k]) => k));
let seed = 12345;
const random = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const absent: { a: (typeof covered)[number]; b: (typeof covered)[number] }[] = [];
while (absent.length < 5000) {
  const a = covered[Math.floor(random() * covered.length)]!;
  const b = covered[Math.floor(random() * covered.length)]!;
  if (a === b || known.has(a.iata < b.iata ? `${a.iata}-${b.iata}` : `${b.iata}-${a.iata}`)) continue;
  absent.push({ a, b });
}
/** Powyżej tylu pasażerów dziennie w jedną stronę trasa prawie na pewno byłaby w danych Eurostatu. */
const ABSENT_LIMIT = 40;

/** Błąd: średni kwadrat różnicy logarytmów. Logarytm, bo trasy różnią się wielkością o rzędy. */
function loss(p: DemandParams): number {
  let sum = 0;
  for (const r of sample) {
    const e = Math.log(yearlyAverageDemand(index, r.a, r.b, p) + 5) - Math.log(r.perDay + 5);
    sum += e * e;
  }
  let over = 0;
  for (const r of absent) {
    const m = yearlyAverageDemand(index, r.a, r.b, p);
    if (m > ABSENT_LIMIT) over += Math.log((m + 5) / (ABSENT_LIMIT + 5)) ** 2;
  }
  return sum / sample.length + over / absent.length;
}

// Proste szukanie: każdy parametr po kolei trochę w górę i w dół; krok maleje, gdy nic nie pomaga.
let best: DemandParams = { kBusiness: 300, kTourism: 0.5, kVfr: 20000, betaBusiness: 1.2, betaTourism: 1.5, betaVfr: 0.5, wealthPower: 1, domesticBoost: 1.5 };
let bestLoss = loss(best);
const scaled: (keyof DemandParams)[] = ['kBusiness', 'kTourism', 'kVfr', 'domesticBoost'];
const shifted: [keyof DemandParams, number, number][] = [
  ['betaBusiness', 1, 2.5],
  ['betaTourism', 1, 2.5],
  ['betaVfr', 0.3, 2],
  ['wealthPower', 0.5, 2.5],
];
let step = 0.5;
for (let round = 0; round < 60 && step > 0.01; round++) {
  let improved = false;
  for (const k of scaled) {
    for (const f of [1 + step, 1 / (1 + step)]) {
      const trial = { ...best, [k]: best[k] * f };
      const l = loss(trial);
      if (l < bestLoss - 1e-7) { best = trial; bestLoss = l; improved = true; }
    }
  }
  for (const [k, lo, hi] of shifted) {
    for (const dlt of [step * 0.4, -step * 0.4]) {
      const v = Math.min(hi, Math.max(lo, best[k] + dlt));
      const trial = { ...best, [k]: v };
      const l = loss(trial);
      if (l < bestLoss - 1e-7) { best = trial; bestLoss = l; improved = true; }
    }
  }
  if (!improved) step *= 0.6;
}
const round = (v: number): number => Number(v.toPrecision(4));
const params = Object.fromEntries(Object.entries(best).map(([k, v]) => [k, round(v)])) as unknown as DemandParams;
writeFileSync('src/sim/demand-params.json', JSON.stringify(params, null, 2) + '\n');

// ---------------------------------------------------------------- raport
const rows = sample.map((r) => ({ ...r, model: yearlyAverageDemand(index, r.a, r.b, params) }));
const ratios = rows.map((r) => (r.model + 5) / (r.perDay + 5)).sort((x, y) => x - y);
const within = (f: number): number => Math.round((100 * ratios.filter((x) => x <= f && x >= 1 / f).length) / ratios.length);
const median = ratios[Math.floor(ratios.length / 2)] ?? 1;
const logs = rows.map((r) => [Math.log(r.model + 5), Math.log(r.perDay + 5)] as const);
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const mx = mean(logs.map((l) => l[0]));
const my = mean(logs.map((l) => l[1]));
const corr =
  logs.reduce((s, l) => s + (l[0] - mx) * (l[1] - my), 0) /
  Math.sqrt(logs.reduce((s, l) => s + (l[0] - mx) ** 2, 0) * logs.reduce((s, l) => s + (l[1] - my) ** 2, 0));

const fmt = (n: number): string => Math.round(n).toLocaleString('pl-PL');
const name = (r: (typeof rows)[number]): string => `${r.a.city || r.a.name} (${r.a.iata}) – ${r.b.city || r.b.name} (${r.b.iata})`;
const line = (r: (typeof rows)[number]): string => `| ${name(r)} | ${fmt(r.perDay)} | ${fmt(r.model)} | ${(r.model / r.perDay).toFixed(2)}× |`;
const pick = (keys: string[]): string =>
  keys
    .map((k) => rows.find((r) => r.key === k || r.key === k.split('-').reverse().join('-')))
    .filter((r): r is (typeof rows)[number] => Boolean(r))
    .map(line)
    .join('\n');
const head = '| Trasa | Naprawdę | Model | Model / naprawdę |\n|---|---|---|---|';
const sortedByError = [...rows].filter((r) => r.perDay > 150).sort((x, y) => y.model / y.perDay - x.model / x.perDay);

const report = `# Kalibracja modelu popytu

Wygenerowane ${new Date().toISOString().slice(0, 10)} poleceniem \`npm run calibrate\`. Nie edytować ręcznie.

Model liczy, ilu ludzi chce lecieć między dwoma lotniskami, z prawdziwych danych o ludności,
zamożności, turystyce i powiązaniach między krajami. Tutaj porównujemy go z prawdziwym ruchem
pasażerów z Eurostatu za ${real.year} rok.

## Wynik

- Tras w porównaniu: **${fmt(rows.length)}** (ruch co najmniej 20 tys. pasażerów rocznie).
- Zgodność rzędu wielkości (korelacja logarytmów): **${corr.toFixed(2)}**.
- Model mieści się w przedziale od połowy do dwukrotności prawdziwego ruchu na **${within(2)}%** tras,
  a w przedziale od jednej trzeciej do trzykrotności na **${within(3)}%**.
- Mediana stosunku model / rzeczywistość: **${median.toFixed(2)}**.
- Z ${fmt(absent.length)} losowych par dobrze opisanych lotnisk, między którymi nikt regularnie nie lata, model widzi
  ponad ${ABSENT_LIMIT} pasażerów dziennie na **${Math.round((100 * absent.filter((r) => yearlyAverageDemand(index, r.a, r.b, params) > ABSENT_LIMIT).length) / absent.length)}%**.

Liczby w tabelach to pasażerowie dziennie w jedną stronę, średnio w roku.

## Jak to czytać

Prawdziwy ruch to nie to samo co popyt. Pokazuje tylko trasy, które ktoś lata, i jest ograniczony
liczbą miejsc w samolotach. Na lotniskach przesiadkowych zawiera też pasażerów, którzy lecą dalej.
Model ma więc trafiać w rząd wielkości i w kolejność tras, a nie w dokładne liczby.

## Trasy z Polski

${head}
${pick(['DTM-KTW', 'KTW-LTN', 'KRK-STN', 'LTN-WAW', 'LHR-WAW', 'CDG-WAW', 'FRA-WAW', 'GDN-WAW', 'KRK-WAW', 'WAW-WRO', 'GDN-OSL', 'AMS-WAW', 'BGY-KRK', 'DUB-KRK', 'EIN-KTW'])}

## Znane trasy w Europie

${head}
${pick(['BCN-MAD', 'LHR-DUB', 'AMS-LHR', 'CDG-LHR', 'FRA-BER', 'MUC-BER', 'FCO-MXP', 'ORY-TLS', 'ARN-CPH', 'LGW-PMI', 'DUS-PMI', 'MAN-AGP', 'ATH-SKG', 'LIS-OPO', 'OSL-TRD'])}

## Gdzie model najbardziej zawyża

${head}
${sortedByError.slice(0, 10).map(line).join('\n')}

## Gdzie model najbardziej zaniża

${head}
${sortedByError.slice(-10).reverse().map(line).join('\n')}

## Dopasowane parametry

\`\`\`json
${JSON.stringify(params, null, 2)}
\`\`\`

## Znane słabości

- **Konkurencja lądowa** zależy na razie tylko od odległości i od tego, czy po drodze jest morze.
  Nie wie o prawdziwych liniach kolejowych ani o wyspach wewnątrz krajów. To następny krok.
- **Lotniska przesiadkowe** (Londyn Heathrow, Frankfurt, Amsterdam, Paryż) mają w rzeczywistości
  dużo pasażerów w tranzycie, których model nie liczy.
- **Wielka Brytania, Turcja i kraje spoza Eurostatu** mają noclegi szacowane z ludności,
  a powiązania z Wielką Brytanią są wpisane w przybliżeniu.
- **Ludność** pochodzi z miejscowości powyżej tysiąca mieszkańców, więc wsie nie są liczone.
`;
writeFileSync('docs/KALIBRACJA.md', report);

console.log(`Trasy: ${rows.length}, korelacja logarytmów ${corr.toFixed(2)}, w przedziale ×2: ${within(2)}%, ×3: ${within(3)}%, mediana ${median.toFixed(2)}`);
console.log(params);
for (const k of ['DTM-KTW', 'KTW-LTN', 'LHR-WAW', 'KRK-WAW', 'BCN-MAD', 'LGW-PMI']) {
  const r = rows.find((x) => x.key === k);
  if (r) console.log(`  ${k}: naprawdę ${fmt(r.perDay)}, model ${fmt(r.model)}`);
}
