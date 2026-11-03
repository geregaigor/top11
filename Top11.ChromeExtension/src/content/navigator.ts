// Синтетичні кліки по Unity canvas. Координати — частки від розміру canvas (0..1).
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const POINTS = {
  home: [0.0257, 0.0255],
  transfers: [0.0257, 0.1889],
  auctionsTab: [0.1976, 0.1589],
  /** Заголовок колонки «ЛЕТ»: перший клік сортує за зростанням, при новому заході скидається */
  ageHeader: [0.5372, 0.2288],
} as const satisfies Record<string, readonly [number, number]>;

function canvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>('#unity-canvas') ?? document.querySelector('canvas');
}

export async function clickRel([fx, fy]: readonly [number, number]): Promise<boolean> {
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

/** Дім -> Трансфери -> Аукціони -> сортування за віком (від наймолодших). Змушує гру запитати свіжий список. */
export async function openAuctions(): Promise<void> {
  await clickRel(POINTS.home);
  await sleep(2000);
  await clickRel(POINTS.transfers);
  await sleep(2000);
  await clickRel(POINTS.auctionsTab);
  await sleep(1500);
  await clickRel(POINTS.ageHeader);
}
