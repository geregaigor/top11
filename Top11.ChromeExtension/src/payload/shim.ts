// Payload-сторінка працює в sandbox (там дозволено запуск завантаженого коду), але без chrome.*.
// Шим підставляє chrome / localStorage / clipboard, які проксують виклики в обгортку через postMessage.
import type { HostMsg } from '../shell/boot';

const boot = window.__T11_BOOT;
if (boot) install(boot);

function install(b: NonNullable<typeof boot>): void {
  let seq = 0;
  const pending = new Map<number, { res: (v: unknown) => void; rej: (e: Error) => void }>();
  const listeners = new Map<number, (...a: unknown[]) => void>();

  window.addEventListener('message', (e: MessageEvent<HostMsg>) => {
    if (e.source !== parent) return;
    const d = e.data;
    if (!d || !('t' in d)) return;
    if (d.t === 'ret') {
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (d.ok) p?.res(d.value);
      else p?.rej(new Error(d.error));
    } else if (d.t === 'event') {
      listeners.get(d.id)?.(...d.args);
    }
  });

  const call = (path: string[], args: unknown[]): Promise<unknown> => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    parent.postMessage({ t: 'call', id, path, args }, '*');
  });

  const sync: Record<string, unknown> = {
    'runtime.getManifest': () => b.manifest,
    'runtime.getURL': (u: string) => `chrome-extension://${b.id}/${u.replace(/^\//, '')}`,
    'runtime.id': b.id,
  };

  const ns = (path: string[]): unknown => new Proxy(function () { /* */ }, {
    get(_t, p) {
      if (typeof p !== 'string' || p === 'then') return undefined;
      if (p === 'addListener') return (cb: (...a: unknown[]) => void) => {
        const id = ++seq;
        listeners.set(id, cb);
        parent.postMessage({ t: 'listen', id, path }, '*');
      };
      if (p === 'removeListener' || p === 'hasListener') return () => false;
      const full = [...path, p].join('.');
      if (full in sync) return sync[full];
      return ns([...path, p]);
    },
    apply(_t, _this, args: unknown[]) { return call(path, args); },
  });
  Object.defineProperty(window, 'chrome', { value: ns([]), configurable: true, writable: true });

  const store = new Map(Object.entries(b.ls));
  const ls: Storage = {
    getItem: k => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); void call(['__ls', 'set'], [k, String(v)]); },
    removeItem: k => { store.delete(k); void call(['__ls', 'remove'], [k]); },
    clear: () => { store.clear(); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  try { Object.defineProperty(window, 'localStorage', { value: ls, configurable: true }); } catch { /* */ }

  const native = navigator.clipboard?.writeText?.bind(navigator.clipboard);
  const clip = {
    writeText: async (t: string) => {
      try {
        if (!native) throw new Error('no clipboard');
        await native(t);
      } catch {
        await call(['__clipboard'], [t]);
      }
    },
  };
  try { Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true }); } catch { /* */ }
}
