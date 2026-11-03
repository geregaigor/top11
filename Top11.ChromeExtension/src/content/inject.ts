// MAIN world, document_start: перехоплюємо WebSocket до того, як Unity його створить.
import { decodeFrame, flatten, FrameType, type DecodedFrame } from './proto';
import { CMD_AUCTION_LIST, matches, parseAuctionList } from './auction';
import { openAuctions } from './navigator';
import {
  BRIDGE_SRC, DEFAULT_SETTINGS, PAGE_SRC,
  type AuctionPlayer, type BridgeMessage, type PageMessage, type Settings,
} from '../shared/messages';

interface Frame {
  ts: number;
  dir: 'in' | 'out';
  len: number;
  u8: Uint8Array;
  dec: DecodedFrame | null;
}

const MAX_FRAMES = 3000;

const state = {
  running: false,
  settings: { ...DEFAULT_SETTINGS } as Settings,
  frames: [] as Frame[],
  sockets: [] as WebSocket[],
  lastList: [] as AuctionPlayer[],
  alerted: new Set<number>(),
};

const log = (...a: unknown[]) => console.log('%c[T11]', 'color:#3c3', ...a);

// ---------- Перехоплення ----------
function record(dir: Frame['dir'], data: unknown): void {
  const push = (u8: Uint8Array) => {
    let dec: DecodedFrame | null = null;
    try { dec = decodeFrame(u8); } catch { /* ignore */ }
    const fr: Frame = { ts: Date.now(), dir, len: u8.length, u8, dec };
    state.frames.push(fr);
    if (state.frames.length > MAX_FRAMES) state.frames.shift();
    if (dir === 'in' && dec) onFrame(dec);
  };

  if (data instanceof ArrayBuffer) push(new Uint8Array(data.slice(0)));
  else if (ArrayBuffer.isView(data)) push(new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  else if (data instanceof Blob) void data.arrayBuffer().then(ab => push(new Uint8Array(ab)));
  else if (typeof data === 'string') push(new TextEncoder().encode(data));
}

const NativeWS = window.WebSocket;
const nativeSend = NativeWS.prototype.send;

NativeWS.prototype.send = function (this: WebSocket, data: Parameters<WebSocket['send']>[0]) {
  try { record('out', data); } catch { /* ignore */ }
  return nativeSend.call(this, data);
};

window.WebSocket = new Proxy(NativeWS, {
  construct(target, args: ConstructorParameters<typeof WebSocket>) {
    const ws = new target(...args);
    state.sockets.push(ws);
    ws.addEventListener('message', e => { try { record('in', e.data); } catch { /* ignore */ } });
    log('WS opened', ws.url);
    return ws;
  },
});

// ---------- Аукціон ----------
function onFrame(dec: DecodedFrame): void {
  if (dec.type !== FrameType.Response || dec.cmd !== CMD_AUCTION_LIST) return;

  const list = parseAuctionList(dec.m, state.settings);
  state.lastList = list;
  const found = list.filter(p => matches(p, state.settings));
  const fresh = found.filter(p => !state.alerted.has(p.id));

  console.groupCollapsed(`[T11] аукціон: ${list.length} гравців, під фільтр: ${found.length}, нових: ${fresh.length}`);
  console.table(list.map(p => ({ name: `${p.firstName} ${p.lastName}`, age: p.age, q: p.quality, pos: p.positions.join(' '), price: p.price, spec: p.special, style: p.hasStyle, match: matches(p, state.settings) })));
  console.groupEnd();

  if (state.running && fresh.length) {
    fresh.forEach(p => state.alerted.add(p.id));
    beep();
    log('ЗНАЙДЕНО:', fresh.map(p => `${p.lastName} ${p.age}р ${p.quality}%`).join(', '));
  }

  postToBridge({ src: PAGE_SRC, cmd: 'scan', payload: { ts: Date.now(), total: list.length, players: list, matches: found } });
}

// ---------- Цикл оновлення ----------
let timer: number | undefined;
let scanning = false;

async function scan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  try { await openAuctions(); }
  catch (e) { log('scan error', e); }
  finally { scanning = false; }
}

function schedule(): void {
  window.clearTimeout(timer);
  if (!state.running) return;
  const jitter = 0.8 + Math.random() * 0.4; // ±20%, щоб не клікати як метроном
  timer = window.setTimeout(async () => { await scan(); schedule(); }, state.settings.intervalSec * 1000 * jitter);
}

function setRunning(running: boolean): void {
  const wasRunning = state.running;
  state.running = running;
  if (running && !wasRunning) {
    state.alerted.clear();
    log('старт моніторингу', state.settings);
    void scan().then(schedule);
  } else if (!running && wasRunning) {
    window.clearTimeout(timer);
    log('стоп');
  }
}

// ---------- Звук ----------
let actx: AudioContext | undefined;

function beep(times = 3): void {
  try {
    actx ??= new AudioContext();
    let t = actx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.frequency.value = 880;
      o.connect(g).connect(actx.destination);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t);
      o.stop(t + 0.25);
      t += 0.35;
    }
  } catch (e) {
    log('beep error', e);
  }
}

// ---------- Дебаг ----------
const hex = (u8: Uint8Array) => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');

function dump(): void {
  const data = state.frames.map(f => ({
    ts: f.ts, dir: f.dir, len: f.len,
    type: f.dec?.type, seq: f.dec?.seq, cmd: f.dec?.cmd, m: f.dec?.m,
    hex: f.dec ? undefined : hex(f.u8),
  }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `t11-frames-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.documentElement.appendChild(a);
  a.click();
  a.remove();
  log('dump', data.length, 'frames');
}

/** Кадри, де є рядок (напр. прізвище гравця), і шляхи полів. */
function find(text: string) {
  return state.frames.flatMap((f, i) => {
    if (!f.dec) return [];
    const paths = flatten(f.dec.m).filter(([, v]) => typeof v === 'string' && v.includes(text)).map(([k]) => k);
    return paths.length ? [{ i, dir: f.dir, cmd: f.dec.cmd.toString(16), len: f.len, paths }] : [];
  });
}

// ---------- Зв'язок з bridge ----------
function postToBridge(m: PageMessage): void {
  window.postMessage(m, '*');
}

window.addEventListener('message', (e: MessageEvent<BridgeMessage>) => {
  if (e.source !== window || e.data?.src !== BRIDGE_SRC) return;
  const msg = e.data;
  switch (msg.cmd) {
    case 'settings':
      state.settings = msg.payload.settings;
      setRunning(msg.payload.running);
      schedule();
      break;
    case 'beep': beep(); break;
    case 'dump': dump(); break;
    case 'scanNow': void scan(); break;
  }
});

declare global {
  interface Window { __t11: unknown }
}
window.__t11 = { state, find, dump, beep, scan, decodeFrame, flatten };
log('injected');
