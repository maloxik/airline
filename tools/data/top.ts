// Podgląd modelu: najmocniejsze kierunki z wybranego lotniska w lutym i w lipcu.
// Użycie: `npx tsx tools/data/top.ts KTW`
import { readFileSync } from 'node:fs';
import { demand, indexWorld, type WorldData } from '../../src/sim/index';

const world = JSON.parse(readFileSync('public/data/world.json', 'utf8')) as WorldData;
const index = indexWorld(world);
const base = index.airports.get(process.argv[2] ?? 'KTW');
if (!base) throw new Error('nie ma takiego lotniska');

for (const month of [1, 6]) {
  const rows = [...index.airports.values()]
    .filter((a) => a !== base)
    .map((a) => ({ a, d: demand(index, base, a, month) }))
    .sort((x, y) => y.d.air - x.d.air)
    .slice(0, 16);
  console.log(`\n${base.iata}, miesiąc ${month + 1}:`);
  for (const { a, d } of rows) {
    console.log(
      `  ${a.iata} ${(a.city || a.name).slice(0, 22).padEnd(22)} ${String(Math.round(d.air)).padStart(5)}  służb. ${Math.round(d.business)}, tur. ${Math.round(d.tourism)}, rodz. ${Math.round(d.vfr)}, ląd ${Math.round(d.landShare * 100)}%`,
    );
  }
}
