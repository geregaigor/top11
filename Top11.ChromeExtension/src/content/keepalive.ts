// MAIN world: «Не засинати у фоні».
// Коли вкладка гри прихована, Chrome зупиняє requestAnimationFrame — Unity стоїть, не відповідає серверу,
// і той рве сокет. Тут: гра завжди бачить «visible», а колбеки rAF у прихованій вкладці смикаємо з Worker'а
// (таймери воркера фон майже не гальмує).

let enabled = true;
export function setKeepAlive(on: boolean): void { enabled = on; }

const visDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
const realState = (): string => (visDesc?.get ? String(visDesc.get.call(document)) : 'visible');
/** Справжня видимість (для діагностики), незалежно від підміни */
export const realHidden = (): boolean => realState() === 'hidden';

try {
  Object.defineProperty(Document.prototype, 'visibilityState', {
    configurable: true,
    get(this: Document) { return enabled ? 'visible' : realState(); },
  });
  Object.defineProperty(Document.prototype, 'hidden', {
    configurable: true,
    get(this: Document) { return enabled ? false : realHidden(); },
  });
  for (const k of ['webkitHidden', 'webkitVisibilityState']) {
    if (k in Document.prototype) Object.defineProperty(Document.prototype, k, {
      configurable: true,
      get(this: Document) { return k === 'webkitHidden' ? (enabled ? false : realHidden()) : (enabled ? 'visible' : realState()); },
    });
  }
} catch (e) { console.warn('[T11] keepalive: не вдалось підмінити visibility', e); }

const realListeners: Array<(hidden: boolean) => void> = [];
/** Підписка на справжню зміну видимості (подію гра може не побачити) */
export function onRealVisibility(cb: (hidden: boolean) => void): void { realListeners.push(cb); }

// Перший у capture-фазі на window — бачимо подію раніше за гру і за потреби глушимо
window.addEventListener('visibilitychange', e => {
  const h = realHidden();
  for (const cb of realListeners) { try { cb(h); } catch { /* */ } }
  if (enabled) e.stopImmediatePropagation();
  if (h) ensureTicker();
}, true);
for (const type of ['blur', 'pagehide', 'freeze']) {
  window.addEventListener(type, e => {
    if (enabled && (type !== 'blur' || e.target === window)) e.stopImmediatePropagation();
  }, true);
}

// ---------- requestAnimationFrame ----------
const nativeRAF = window.requestAnimationFrame.bind(window);
const nativeCAF = window.cancelAnimationFrame.bind(window);
const queue = new Map<number, { cb: FrameRequestCallback; nid: number }>();
let nextId = 0;

window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  const id = ++nextId;
  const nid = nativeRAF(t => { if (queue.delete(id)) cb(t); });
  queue.set(id, { cb, nid });
  return id;
};
window.cancelAnimationFrame = (id: number): void => {
  const e = queue.get(id);
  if (!e) return;
  nativeCAF(e.nid);
  queue.delete(id);
};

function tick(): void {
  if (!enabled || !realHidden() || !queue.size) return;
  const batch = [...queue.values()];
  queue.clear();
  const now = performance.now();
  for (const e of batch) {
    nativeCAF(e.nid);
    try { e.cb(now); } catch (err) { setTimeout(() => { throw err; }); }
  }
}

let ticking = false;
function ensureTicker(): void {
  if (ticking) return;
  ticking = true;
  try {
    const src = 'setInterval(function(){postMessage(0)},33)';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = tick;
    w.onerror = () => { w.terminate(); fallback(); };
  } catch { fallback(); }
}
/** Інтервал, який фон не гальмує (Worker), з запасним setInterval */
export function workerInterval(fn: () => void, ms: number): void {
  try {
    const w = new Worker(URL.createObjectURL(new Blob([`setInterval(function(){postMessage(0)},${ms})`], { type: 'text/javascript' })));
    w.onmessage = () => fn();
    w.onerror = () => { w.terminate(); setInterval(fn, ms); };
  } catch { setInterval(fn, ms); }
}

function fallback(): void {
  console.warn('[T11] keepalive: Worker недоступний, падаю на setInterval');
  setInterval(tick, 33);
}

if (realHidden()) ensureTicker();
