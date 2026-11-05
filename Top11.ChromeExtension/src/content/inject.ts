// MAIN world, document_start: перехоплюємо WebSocket до того, як Unity його створить.
import { onRealVisibility, realHidden, setKeepAlive, workerInterval } from './keepalive';
import { decodeFrame, flatten, FrameType, type DecodedFrame } from './proto';
import { CMD_AUCTION_LIST, matches, parseAuctionList } from './auction';
import { CMD_MATCH_PREVIEW, collectK, parseSquad } from './squad';
import { hideOverlay, renderOverlay } from './overlay';
import { installMenuButton } from './menu-button';
import {
  BRIDGE_SRC, DEFAULT_SETTINGS, PAGE_SRC,
  type AuctionPlayer, type BridgeMessage, type FrameDTO, type FramesReply, type PageMessage, type Settings, type WsEvent,
} from '../shared/messages';

interface Frame {
  id: number;
  ts: number;
  dir: 'in' | 'out';
  len: number;
  u8: Uint8Array;
  /** Лише заголовок; повне дерево розбираємо на вимогу (економія памʼяті за довгу сесію) */
  head: { type: number; seq: number; cmd: number } | null;
}

const MAX_FRAMES = 10000;
/** Ліміт буфера за обсягом сирих байтів */
const MAX_BYTES = 40 * 1024 * 1024;
let bufBytes = 0;
/** Скільки кадрів віддавати переглядачу за один запит */
const FRAMES_CHUNK = 1500;
let nextFrameId = 0;

const state = {
  settings: { ...DEFAULT_SETTINGS } as Settings,
  frames: [] as Frame[],
  sockets: [] as WebSocket[],
  lastList: [] as AuctionPlayer[],
  alerted: new Set<number>(),
};

const log = (...a: unknown[]) => console.log('%c[T11]', 'color:#3c3', ...a);

// ---------- Перехоплення ----------
let lastInTs = 0;
function record(dir: Frame['dir'], data: unknown): void {
  const push = (u8: Uint8Array) => {
    let dec: DecodedFrame | null = null;
    try { dec = decodeFrame(u8); } catch { /* ignore */ }
    const head = dec ? { type: dec.type, seq: dec.seq, cmd: dec.cmd } : null;
    state.frames.push({ id: nextFrameId++, ts: Date.now(), dir, len: u8.length, u8, head });
    if (dir === 'in') lastInTs = Date.now();
    bufBytes += u8.length;
    while (state.frames.length > MAX_FRAMES || (bufBytes > MAX_BYTES && state.frames.length > 1)) {
      bufBytes -= state.frames.shift()!.len;
    }
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
    ws.addEventListener('open', () => wsEvent({ kind: 'open' }));
    ws.addEventListener('error', () => wsEvent({ kind: 'error' }));
    ws.addEventListener('close', e => wsEvent({ kind: 'close', code: e.code, reason: e.reason }));
    log('WS opened', ws.url);
    return ws;
  },
});

// ---------- Діагностика розривів ----------
let hiddenSince = realHidden() ? Date.now() : 0;

function wsEvent(e: Omit<WsEvent, 'ts' | 'visible'>): void {
  const visible = !realHidden();
  const ev: WsEvent = { ...e, ts: Date.now(), visible };
  if (!visible && hiddenSince) ev.hiddenSec = Math.round((Date.now() - hiddenSince) / 1000);
  log('WS', ev.kind, ev.code ?? '', ev.reason ?? '', visible ? 'вкладка видима' : `вкладка прихована ${ev.hiddenSec ?? '?'} с`);
  postToBridge({ src: PAGE_SRC, cmd: 'wsEvent', payload: ev });
  sendLive();
}

/** Пульс для індикатора на сторінці розширення */
function sendLive(): void {
  postToBridge({ src: PAGE_SRC, cmd: 'live', payload: {
    wsOpen: state.sockets.some(s => s.readyState === 1),
    lastInTs, hidden: realHidden(), keepAlive: state.settings.keepAlive !== false,
  } });
}
workerInterval(sendLive, 3000);

onRealVisibility(hidden => {
  hiddenSince = hidden ? Date.now() : 0;
  postToBridge({ src: PAGE_SRC, cmd: 'wsEvent', payload: { ts: Date.now(), kind: hidden ? 'hidden' : 'visible', visible: !hidden } });
});

/** id гравців своєї команди (зі стартового кадру) — щоб у превʼю матчу відрізнити своїх від суперника */
let squadIds = new Set<number>();

// ---------- Аукціон ----------
function onFrame(dec: DecodedFrame): void {
  if (dec.type !== FrameType.Response) return;
  // склад шукаємо в будь-якій відповіді з полем 106 (зараз це стартовий 0x0002)
  if (dec.m.some(x => x.f === 106)) {
    const players = parseSquad(dec.m);
    if (players) {
      squadIds = new Set(players.map(p => p.id));
      log('склад:', players.length, 'гравців');
      postToBridge({ src: PAGE_SRC, cmd: 'squad', payload: { ts: Date.now(), players } });
    }
  }
  if (dec.cmd === CMD_MATCH_PREVIEW && squadIds.size) {
    const found = collectK(dec.m, squadIds);
    const n = Object.keys(found).length;
    if (n) {
      const ts = Date.now();
      log('К своїх гравців з превʼю матчу:', n);
      postToBridge({ src: PAGE_SRC, cmd: 'squadK', payload: Object.fromEntries(Object.entries(found).map(([id, k]) => [id, { k, ts }])) });
    }
  }
  if (dec.cmd !== CMD_AUCTION_LIST) return;

  const list = parseAuctionList(dec.m);
  state.lastList = list;
  if (state.settings.overlay) renderOverlay(list, p => matches(p, state.settings));
  const found = list.filter(p => matches(p, state.settings));
  const fresh = found.filter(p => !state.alerted.has(p.id));

  console.groupCollapsed(`[T11] аукціон: ${list.length} гравців, під фільтр: ${found.length}, нових: ${fresh.length}`);
  console.table(list.map(p => ({ name: `${p.firstName} ${p.lastName}`, age: p.age, q: p.quality, pos: p.positions.join(' '), price: p.price, spec: p.special, style: p.hasStyle, match: matches(p, state.settings) })));
  console.groupEnd();

  if (fresh.length) {
    fresh.forEach(p => state.alerted.add(p.id));
    if (state.settings.sound) beep();
    log('ЗНАЙДЕНО:', fresh.map(p => `${p.lastName} ${p.age}р ОБЩ ${p.quality}`).join(', '));
  }

  postToBridge({ src: PAGE_SRC, cmd: 'scan', payload: { ts: Date.now(), total: list.length, players: list, matches: found } });
}

// ---------- Звук ----------
let actx: AudioContext | undefined;

function beep(times = 3): void {
  try {
    actx ??= new AudioContext();
    // без кліку у вкладці гри Chrome тримає аудіо «suspended» — пробуємо розбудити
    if (actx.state === 'suspended') void actx.resume().catch(() => undefined);
    if (actx.state !== 'running') log('звук у вкладці гри заблоковано (не було кліку в грі) — сигнал зі сторінки Top11 / сповіщення');
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

const decOf = (f: Frame): DecodedFrame | null => {
  if (!f.head) return null;
  try { return decodeFrame(f.u8); } catch { return null; }
};

const toDTO = (f: Frame): FrameDTO => {
  const dec = decOf(f);
  return {
    id: f.id, ts: f.ts, dir: f.dir, len: f.len,
    type: dec?.type, seq: dec?.seq, cmd: dec?.cmd, m: dec?.m,
    hex: dec ? undefined : hex(f.u8.subarray(0, 4096)),
  };
};

function framesSince(since: number): FramesReply {
  const all = state.frames;
  // id монотонні — шукаємо перший потрібний з кінця (зазвичай питають тільки нові)
  let i = all.length;
  while (i > 0 && all[i - 1]!.id >= since) i--;
  const chunk = all.slice(i, i + FRAMES_CHUNK);
  const last = chunk[chunk.length - 1];
  return {
    session: performance.timeOrigin,
    firstId: all[0]?.id ?? nextFrameId,
    nextId: last ? last.id + 1 : Math.max(since, nextFrameId),
    more: i + FRAMES_CHUNK < all.length,
    frames: chunk.map(toDTO),
  };
}

function dump(): void {
  const data = state.frames.map(toDTO);
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
    const dec = decOf(f);
    if (!dec) return [];
    const paths = flatten(dec.m).filter(([, v]) => typeof v === 'string' && v.includes(text)).map(([k]) => k);
    return paths.length ? [{ i, id: f.id, dir: f.dir, cmd: dec.cmd.toString(16), len: f.len, paths }] : [];
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
      setKeepAlive(state.settings.keepAlive !== false);
      if (!state.settings.overlay) hideOverlay();
      else if (state.lastList.length) renderOverlay(state.lastList, p => matches(p, state.settings));
      break;
    case 'beep': beep(); break;
    case 'dump': dump(); break;
    case 'frames': postToBridge({ src: PAGE_SRC, cmd: 'frames', reqId: msg.reqId, payload: framesSince(msg.since) }); break;
  }
});

declare global {
  interface Window { __t11: unknown }
}
window.__t11 = { state, find, dump, beep, decodeFrame, decOf, flatten };
installMenuButton(() => postToBridge({ src: PAGE_SRC, cmd: 'openViewer' }));
log('injected');
