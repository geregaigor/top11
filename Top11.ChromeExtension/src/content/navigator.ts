// Синтетичні кліки по Unity canvas. Координати — частки від розміру canvas (0..1), калібруються мишкою.
import { DEFAULT_NAV_POINTS, NAV_STEPS, type NavPoint, type NavPoints } from '../shared/messages';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let points: NavPoints = { ...DEFAULT_NAV_POINTS };
export const setNavPoints = (p: NavPoints) => { points = { ...DEFAULT_NAV_POINTS, ...p }; };

function canvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>('#unity-canvas') ?? document.querySelector('canvas');
}

export async function clickRel([fx, fy]: NavPoint): Promise<boolean> {
  const c = canvas();
  if (!c) return false;
  const r = c.getBoundingClientRect();
  const base = {
    bubbles: true, cancelable: true, view: window,
    clientX: r.left + r.width * fx, clientY: r.top + r.height * fy,
    button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
  };
  c.dispatchEvent(new PointerEvent('pointermove', base));
  c.dispatchEvent(new MouseEvent('mousemove', base));
  c.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
  c.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
  await sleep(60);
  c.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
  c.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
  c.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  return true;
}

/**
 * Дім -> Трансфери -> Аукціони. Успіх = гра надіслала запит списку аукціону (waitList).
 * Після успіху — сортування за віком (від наймолодших).
 */
export async function openAuctions(waitList: (ms: number) => Promise<boolean>): Promise<boolean> {
  await clickRel(points.home);
  await sleep(2000);
  await clickRel(points.transfers);
  await sleep(2000);
  const listed = waitList(5000);
  await clickRel(points.auctionsTab);
  if (!(await listed)) return false;
  await sleep(1500);
  await clickRel(points.ageHeader);
  return true;
}

// ---------- Калібрування: користувач сам клікає по черзі, ми запамʼятовуємо точки ----------
let calibrating = false;

export function startCalibration(onDone: (p: NavPoints) => void): void {
  const c = canvas();
  if (!c || calibrating) return;
  calibrating = true;
  const result: Partial<Record<keyof NavPoints, NavPoint>> = {};
  let step = 0;

  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;'
    + 'background:#10141c;color:#fff;border:2px solid #2fa84f;border-radius:8px;padding:10px 16px;'
    + 'font:600 15px system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none';
  document.documentElement.appendChild(hint);
  const show = () => { hint.textContent = `Top11 калібрування ${step + 1}/${NAV_STEPS.length}: клікни ${NAV_STEPS[step]!.label}  (Esc — скасувати)`; };
  show();

  const finish = (ok: boolean) => {
    c.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('keydown', onKey, true);
    calibrating = false;
    hint.textContent = ok ? 'Top11: калібрування збережено ✓' : 'Top11: калібрування скасовано';
    setTimeout(() => hint.remove(), 2000);
    if (ok) onDone({ ...DEFAULT_NAV_POINTS, ...result } as NavPoints);
  };

  // клік не перехоплюємо — гра його теж отримує, тож ти по ходу відкриваєш аукціон
  const onDown = (e: PointerEvent) => {
    if (!e.isTrusted || e.button !== 0) return;
    const r = c.getBoundingClientRect();
    const p: NavPoint = [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)];
    result[NAV_STEPS[step]!.key] = p;
    step++;
    if (step >= NAV_STEPS.length) finish(true); else show();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(false); };
  c.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', onKey, true);
}
