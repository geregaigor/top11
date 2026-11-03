// Isolated world: chrome.storage / runtime <-> сторінка (MAIN world) через postMessage.
import {
  BRIDGE_SRC, PAGE_SRC, loadHistory, loadState,
  type BridgeMessage, type FramesReply, type PageMessage, type PopupCommand, type ScanResult, type ViewerRequest,
} from '../shared/messages';

/** Після ↻ розширення старий content script лишається на сторінці, але chrome.* в ньому вже мертві. */
const alive = () => { try { return Boolean(chrome.runtime?.id); } catch { return false; } };

type Outgoing = BridgeMessage extends infer M ? (M extends { src: string } ? Omit<M, 'src'> : never) : never;
const post = (m: Outgoing) => window.postMessage({ src: BRIDGE_SRC, ...m }, '*');

async function pushSettings(): Promise<void> {
  if (!alive()) return;
  try {
    post({ cmd: 'settings', payload: await loadState() });
  } catch (e) {
    console.warn('[T11] settings error', e);
  }
}

/** Додає знайдених у історію (по id): оновлює дані, лічильник і діапазон цін. */
async function saveToHistory(scan: ScanResult): Promise<void> {
  if (!scan.matches.length) return;
  const history = await loadHistory();
  for (const p of scan.matches) {
    const key = String(p.id);
    const prev = history[key];
    history[key] = prev
      ? {
          player: p,
          firstSeen: prev.firstSeen,
          lastSeen: scan.ts,
          // той самий лот у межах раунду бачимо кожен скан — рахуємо тільки нові появи (> 10 хв перерви)
          timesSeen: scan.ts - prev.lastSeen > 10 * 60_000 ? prev.timesSeen + 1 : prev.timesSeen,
          minPrice: Math.min(prev.minPrice, p.price),
          maxPrice: Math.max(prev.maxPrice, p.price),
        }
      : { player: p, firstSeen: scan.ts, lastSeen: scan.ts, timesSeen: 1, minPrice: p.price, maxPrice: p.price };
  }
  await chrome.storage.local.set({ history });
}

// Скани приходять послідовно, але storage асинхронний — серіалізуємо записи.
let queue = Promise.resolve();

chrome.storage.onChanged.addListener((changes) => {
  if ('running' in changes || 'settings' in changes) void pushSettings();
});
// Запити переглядача трафіку: чекаємо відповідь від inject і повертаємо її через sendResponse.
let reqSeq = 0;
const pending = new Map<number, (r?: FramesReply) => void>();

chrome.runtime.onMessage.addListener((msg: PopupCommand | ViewerRequest, _sender, sendResponse) => {
  if (msg.cmd === 'frames') {
    const reqId = ++reqSeq;
    pending.set(reqId, sendResponse);
    window.setTimeout(() => { if (pending.delete(reqId)) sendResponse(undefined); }, 5000);
    post({ cmd: 'frames', reqId, since: msg.since });
    return true; // async sendResponse
  }
  if (msg.cmd === 'ping') {
    // живий content script — сторінка розширення може слати команди і чекати сканів
    sendResponse({ ok: true });
    return false;
  }
  post({ cmd: msg.cmd });
  return false;
});

window.addEventListener('message', (e: MessageEvent<PageMessage>) => {
  if (e.source !== window || e.data?.src !== PAGE_SRC) return;
  if (e.data.cmd === 'frames') {
    pending.get(e.data.reqId)?.(e.data.payload);
    pending.delete(e.data.reqId);
    return;
  }
  if (e.data.cmd === 'squad') {
    if (alive()) void chrome.storage.local.set({ squad: e.data.payload });
    return;
  }
  if (e.data.cmd === 'scan') {
    if (!alive()) {
      console.warn('[T11] розширення перезавантажено — онови вкладку гри (F5)');
      return;
    }
    const scan = e.data.payload;
    queue = queue.then(async () => {
      await chrome.storage.local.set({ lastScan: scan });
      await saveToHistory(scan);
    }).catch(err => console.warn('[T11] history error', err));
  }
});

void pushSettings();
document.addEventListener('DOMContentLoaded', () => void pushSettings());
