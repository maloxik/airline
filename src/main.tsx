import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './app/styles.css';
import { App } from './app/App';

// Wątek roboczy mapy leży w public/maplibre (kopiuje go tools/copy-map-worker.mjs), więc działa tak samo w dev i po zbudowaniu.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

// Tylko w trybie deweloperskim: gdy okno podglądu jest zasłonięte, przeglądarka wstrzymuje klatki animacji.
// Zapasowy zegar utrzymuje ruch, żeby zmianę dało się obejrzeć i sprawdzić. W zbudowanej grze go nie ma.
if (import.meta.env.DEV) {
  const native = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    let done = false;
    const run = (t: number): void => {
      if (done) return;
      done = true;
      cb(t);
    };
    const id = native(run);
    setTimeout(() => run(performance.now()), 48);
    return id;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
