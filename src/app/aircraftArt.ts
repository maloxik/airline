/**
 * Sylwetki samolotów z boku: własne rysunki w proporcjach prawdziwych typów, w barwach linii gracza.
 * Bez logo producentów i bez prawdziwych malowań.
 */
import type { AircraftType } from '../sim';

interface Shape {
  /** Wysokość kadłuba na rysunku. */
  h: number;
  winglet: 'shark' | 'split' | 'small' | 'none';
  engine: number;
  /** Owiewka podwozia pod kadłubem (ATR). */
  pod?: boolean;
}

/** Kształt wynika z klasy samolotu i producenta; długość bierzemy z katalogu. */
function shapeOf(type: AircraftType): Shape {
  if (type.cls === 'tp') return { h: 23, winglet: 'none', engine: 1, pod: type.maker === 'ATR' };
  const winglet: Shape['winglet'] = !type.efficient ? 'small' : type.maker === 'Boeing' && type.cls === 'nb' ? 'split' : type.cls === 'wb' ? 'small' : 'shark';
  if (type.cls === 'rj') return { h: 25, winglet, engine: type.efficient ? 1.1 : 0.95 };
  if (type.cls === 'nb') return { h: 29, winglet, engine: type.efficient ? 1.08 : 0.95 };
  return { h: 33, winglet, engine: 1.25 };
}

let counter = 0;

/** Zwraca gotowy znacznik SVG. `brand` to kolor linii, `airline` trafia na kadłub. */
export function aircraftSvg(type: AircraftType, brand: string, airline: string): string {
  const s = shapeOf(type);
  const tp = type.kind === 'tp';
  const h = s.h;
  // Największe samoloty skalujemy tak, żeby zmieściły się w kadrze.
  const L = type.lengthM * Math.min(8.1, 384 / type.lengthM);
  const x0 = (420 - L) / 2;
  const x1 = x0 + L;
  const yT = tp ? 46 : 52;
  const yB = yT + h;
  const xm = x0 + L * (tp ? 0.43 : 0.4);
  const id = `ac${counter++}`;
  const o = '#22252c';
  const g = '#dfe3e9';
  const st = `stroke="${o}" stroke-width=".9" stroke-linejoin="round"`;
  const n = (v: number): string => v.toFixed(1);
  const fus = `M${n(x0)} ${n(yT + h * 0.58)}C${n(x0)} ${n(yT + h * 0.2)} ${n(x0 + h * 0.6)} ${yT} ${n(x0 + h * 1.4)} ${yT}L${n(x1 - h * 1.6)} ${yT}C${n(x1 - h * 0.8)} ${yT} ${n(x1 - h * 0.2)} ${n(yT + h * 0.1)} ${n(x1)} ${n(yT + h * 0.2)}L${n(x1)} ${n(yT + h * 0.36)}C${n(x1 - h * 1.3)} ${n(yT + h * 0.6)} ${n(x1 - h * 2.3)} ${yB} ${n(x1 - h * 3.5)} ${yB}L${n(x0 + h * 1.15)} ${yB}C${n(x0 + h * 0.45)} ${yB} ${n(x0)} ${n(yT + h * 0.9)} ${n(x0)} ${n(yT + h * 0.58)}Z`;
  const fh = tp ? 1.28 : 1.36;
  const fin = `M${n(x1 - h * 2.35)} ${yT + 1}L${n(x1 - h * 0.98)} ${n(yT - h * fh)}L${n(x1 - h * 0.3)} ${n(yT - h * fh)}L${n(x1 - h * 0.62)} ${yT + 1}Z`;
  let windows = '';
  for (let x = x0 + h * 1.8; x < x1 - h * 3.3; x += 5.7) windows += `<rect x="${n(x)}" y="${n(yT + h * 0.36)}" width="2.7" height="3.5" rx=".9" fill="#2b3140"/>`;
  const door = (x: number): string => `<rect x="${n(x)}" y="${n(yT + h * 0.27)}" width="4.6" height="${n(h * 0.5)}" rx="1.2" fill="none" stroke="#a3a9b4" stroke-width=".7"/>`;
  const stab = tp
    ? `<path d="M${n(x1 - h * 1.25)} ${n(yT - h * fh - 1)}h${n(h * 1.45)}l${n(-h * 0.12)} ${n(h * 0.13)}h${n(-h * 1.2)}z" fill="${g}" ${st}/>`
    : `<path d="M${n(x1 - h * 1.95)} ${n(yT + h * 0.4)}L${n(x1 - h * 0.1)} ${n(yT + h * 0.2)}L${n(x1 + h * 0.22)} ${n(yT + h * 0.2)}L${n(x1 - h * 0.7)} ${n(yT + h * 0.44)}Z" fill="${g}" ${st}/>`;
  let wing: string;
  if (tp) {
    wing = `<path d="M${n(xm - h * 0.55)} ${n(yT + 1.5)}H${n(xm + h * 0.95)}L${n(xm + h * 0.8)} ${n(yT - h * 0.1)}H${n(xm - h * 0.45)}Z" fill="${g}" ${st}/>
      ${s.pod ? `<ellipse cx="${n(xm + h * 0.25)}" cy="${n(yB - 0.5)}" rx="${n(h * 1.05)}" ry="${n(h * 0.17)}" fill="#eef0f4" ${st}/>` : ''}
      <rect x="${n(xm - h * 1.3)}" y="${n(yT - h * 0.02)}" width="${n(h * (s.pod ? 1.75 : 2.3))}" height="${n(h * 0.36)}" rx="${n(h * 0.17)}" fill="#eef0f4" ${st}/>
      <path d="M${n(xm - h * 1.3)} ${n(yT + h * 0.05)}l${n(-h * 0.26)} ${n(h * 0.11)}l${n(h * 0.26)} ${n(h * 0.11)}z" fill="${o}"/>
      <ellipse cx="${n(xm - h * 1.44)}" cy="${n(yT + h * 0.16)}" rx="1.7" ry="${n(h * 0.68)}" fill="rgba(34,37,44,.3)"/>`;
  } else {
    const e = s.engine;
    const wx = xm + h * 2.2;
    const wy = yB - h * 0.5;
    const ny = yB - h * 0.14;
    const wl =
      s.winglet === 'shark'
        ? `<path d="M${n(wx)} ${n(wy)}L${n(wx + h * 0.4)} ${n(wy - h * 0.6)}h${n(h * 0.13)}L${n(wx + h * 0.36)} ${n(wy)}Z" fill="${brand}" ${st}/>`
        : s.winglet === 'split'
          ? `<path d="M${n(wx)} ${n(wy)}L${n(wx + h * 0.38)} ${n(wy - h * 0.55)}h${n(h * 0.12)}L${n(wx + h * 0.36)} ${n(wy)}L${n(wx + h * 0.46)} ${n(wy + h * 0.3)}h${n(-h * 0.12)}Z" fill="${brand}" ${st}/>`
          : s.winglet === 'small'
            ? `<path d="M${n(wx)} ${n(wy)}L${n(wx + h * 0.32)} ${n(wy - h * 0.26)}h${n(h * 0.12)}L${n(wx + h * 0.36)} ${n(wy)}Z" fill="${g}" ${st}/>`
            : '';
    wing = `<path d="M${n(xm - h * 0.6)} ${n(yB - h * 0.3)}L${n(wx)} ${n(wy)}h${n(h * 0.36)}L${n(xm + h * 1.55)} ${n(yB - h * 0.2)}Z" fill="${g}" ${st}/>${wl}
      <rect x="${n(xm - h * 0.95)}" y="${n(ny)}" width="${n(h * 1.12 * e)}" height="${n(h * 0.56 * e)}" rx="${n(h * 0.25)}" fill="#f4f5f8" ${st}/>
      <rect x="${n(xm - h * 0.95)}" y="${n(ny)}" width="${n(h * 0.16)}" height="${n(h * 0.56 * e)}" rx="${n(h * 0.08)}" fill="#8e95a2"/>`;
  }
  const title = airline.toUpperCase().replace(/[<>&]/g, '').slice(0, 16);
  return `<svg viewBox="0 0 420 ${tp ? 90 : 106}" role="img" aria-label="${type.maker} ${type.name}"><defs><clipPath id="${id}"><path d="${fus}"/></clipPath></defs>
    <path d="${fin}" fill="${brand}" ${st}/><circle cx="${n(x1 - h * 0.98)}" cy="${n(yT - h * fh * 0.5)}" r="${n(h * 0.2)}" fill="#fff"/>
    ${stab}<path d="${fus}" fill="#fff"/>
    <g clip-path="url(#${id})"><rect x="${n(x0)}" y="${n(yT + h * 0.76)}" width="${n(L)}" height="${h}" fill="${brand}"/></g>
    <path d="${fus}" fill="none" ${st}/>
    <path d="M${n(x0 + h * 0.34)} ${n(yT + h * 0.36)}L${n(x0 + h * 0.92)} ${n(yT + h * 0.15)}H${n(x0 + h * 1.1)}L${n(x0 + h * 1.0)} ${n(yT + h * 0.42)}L${n(x0 + h * 0.38)} ${n(yT + h * 0.45)}Z" fill="#2b3140"/>
    ${windows}${door(x0 + h * 1.3)}${door(x1 - h * 3.2)}
    <text x="${n(x0 + h * 1.9)}" y="${n(yT + h * 0.26)}" font-family="Instrument Sans,sans-serif" font-weight="700" font-size="6.6" fill="${brand}" letter-spacing=".6">${title}</text>${wing}</svg>`;
}
