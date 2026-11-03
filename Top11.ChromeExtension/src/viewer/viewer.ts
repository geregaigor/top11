// Переглядач усього трафіку websocket гри: команди, кадри, дерево protobuf-полів.
import { isMsg, type PbField, type PbValue } from '../content/proto';
import type { FrameDTO, FramesReply, ViewerRequest } from '../shared/messages';
import { initSquadView } from './squad-view';
import { initAuctionView } from './auction-view';
import { findGameTab, forgetGameTab } from './game-tab';

const POLL_MS = 1500;
const MAX_ROWS = 2000;
const NO_CMD = -1;

/** Відомі команди. Решту підписуєш сам у таблиці — зберігається в storage. */
const KNOWN: Record<number, string> = {
  0x3e80: 'Аукціон: список лотів',
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const hex4 = (c: number) => (c === NO_CMD ? '—' : '0x' + c.toString(16).toUpperCase().padStart(4, '0'));
const nf = new Intl.NumberFormat('uk-UA');

const st = {
  tabId: undefined as number | undefined,
  session: undefined as number | undefined,
  since: 0,
  lost: 0,
  frames: [] as FrameDTO[],
  byId: new Map<number, FrameDTO>(),
  names: {} as Record<string, string>,
  hidden: new Set<number>(),
  selCmd: null as number | null,
  selId: null as number | null,
  dir: 'all' as 'all' | 'in' | 'out',
  q: '',
  live: true,
};

const cmdOf = (f: FrameDTO) => f.cmd ?? NO_CMD;
const cmdName = (c: number) => (c === NO_CMD ? 'не розібрано' : st.names[c] ?? KNOWN[c] ?? '');
const typeName = (t?: number) => (t === 0 ? 'запит' : t === 1 ? 'відповідь' : t == null ? '?' : `тип ${t}`);
const relSec = (ts: number) => ((ts - (st.session ?? ts)) / 1000).toFixed(1);

// ---------- Значення ----------
const fmtDate = (ms: number) => new Date(ms).toLocaleString('uk-UA');

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/** Підказка до числа: дата, від'ємне int64, скорочення. */
function hint(n: number): string {
  let h = '';
  if (Number.isInteger(n)) {
    if (n >= 2 ** 63) h = `= ${n - 2 ** 64} (від'ємне)`;
    else if (n >= 1.42e9 && n <= 2.08e9) h = `🕒 ${fmtDate(n * 1000)}`;
    else if (n >= 1.42e12 && n <= 2.08e12) h = `🕒 ${fmtDate(n)}`;
    else if (Math.abs(n) >= 1e4) h = compact(n);
  }
  return h ? ` <span class="hint">${esc(h)}</span>` : '';
}

const saneFloat = (x: number) => Number.isFinite(x) && (x === 0 || (Math.abs(x) > 1e-5 && Math.abs(x) < 1e9));

function leafText(v: PbValue): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if ('d' in v) return String(v.d);
  if ('fl' in v) return `${v.fl} ${v.u}`;
  if ('hex' in v) return v.hex;
  return '';
}

function fmtLeaf(v: PbValue): string {
  if (typeof v === 'string') return `<span class="t">str</span> <span class="s">"${esc(v)}"</span>`;
  if (typeof v === 'number') return `<span class="t">int</span> <span class="n">${v}</span>${hint(v)}`;
  if ('d' in v) return `<span class="t">double</span> <span class="n">${+v.d.toPrecision(12)}</span>${hint(v.d)}`;
  if ('fl' in v) {
    return saneFloat(v.fl)
      ? `<span class="t">float</span> <span class="n">${+v.fl.toPrecision(7)}</span> <span class="hint">u32 ${v.u}</span>`
      : `<span class="t">u32</span> <span class="n">${v.u}</span>${hint(v.u)}`;
  }
  if ('hex' in v) return `<span class="t">bytes·${v.len}</span> <span class="h">${v.hex}</span>`;
  return '';
}

function* leaves(m: PbField[]): Generator<PbValue> {
  for (const x of m) {
    if (isMsg(x.v)) yield* leaves(x.v.m);
    else yield x.v;
  }
}

/** Короткий зміст повідомлення: перші рядки, а якщо їх нема — перші числа верхнього рівня. */
function summary(m: PbField[], max = 4): string {
  const strs: string[] = [];
  for (const v of leaves(m)) {
    if (typeof v === 'string' && v.trim()) strs.push(v.length > 40 ? v.slice(0, 40) + '…' : v);
    if (strs.length >= max) break;
  }
  if (strs.length) return strs.join(' · ');
  return m.slice(0, max).map(x => `${x.f}=${isMsg(x.v) ? '{…}' : leafText(x.v).slice(0, 20)}`).join(' ');
}

const previews = new Map<number, string>();
function preview(f: FrameDTO): string {
  let p = previews.get(f.id);
  if (p === undefined) {
    p = f.m ? (f.m.length ? summary(f.m, 6) : '(порожньо)') : f.hex ? `hex ${f.hex.slice(0, 40)}…` : '';
    previews.set(f.id, p);
  }
  return p;
}

// ---------- Пошук ----------
const leafHit = (v: PbValue, q: string) => leafText(v).toLowerCase().includes(q);
function msgHit(m: PbField[], q: string): boolean {
  for (const v of leaves(m)) if (leafHit(v, q)) return true;
  return false;
}
function frameHit(f: FrameDTO, q: string): boolean {
  const c = cmdOf(f);
  return hex4(c).toLowerCase().includes(q) || cmdName(c).toLowerCase().includes(q)
    || (f.m ? msgHit(f.m, q) : (f.hex ?? '').includes(q));
}

function visible(): FrameDTO[] {
  const q = st.q;
  return st.frames.filter(f => {
    const c = cmdOf(f);
    if (st.dir !== 'all' && f.dir !== st.dir) return false;
    if (st.selCmd !== null ? c !== st.selCmd : st.hidden.has(c)) return false;
    return !q || frameHit(f, q);
  });
}

// ---------- Рендер ----------
function renderCmds(): void {
  // не перебиваємо введення назви
  if ((document.activeElement as HTMLElement | null)?.classList.contains('name')) return;
  const stats = new Map<number, { first: FrameDTO; out: number; inn: number; bytes: number }>();
  for (const f of st.frames) {
    const c = cmdOf(f);
    let s = stats.get(c);
    if (!s) stats.set(c, (s = { first: f, out: 0, inn: 0, bytes: 0 }));
    if (f.dir === 'out') s.out++; else s.inn++;
    s.bytes += f.len;
  }
  let i = 0;
  $('cmdBody').innerHTML = [...stats.entries()]
    .sort((a, b) => a[1].first.id - b[1].first.id)
    .map(([c, s]) => `<tr data-cmd="${c}" class="${st.selCmd === c ? 'sel' : ''} ${st.hidden.has(c) ? 'off' : ''}">
      <td class="n">${++i}</td><td class="mono">${hex4(c)}</td>
      <td><input class="name" data-cmd="${c}" value="${esc(cmdName(c))}" placeholder="—" ${c === NO_CMD ? 'disabled' : ''}></td>
      <td class="n out">${s.out || ''}</td><td class="n in">${s.inn || ''}</td>
      <td class="n">${compact(s.bytes)}</td><td class="n">${relSec(s.first.ts)}</td>
      <td><input type="checkbox" class="show" data-cmd="${c}" ${st.hidden.has(c) ? '' : 'checked'}></td></tr>`)
    .join('');
}

function renderFrames(): void {
  const box = $('frames');
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  const list = visible();
  const shown = list.slice(-MAX_ROWS);
  $('framesMeta').textContent = `${nf.format(list.length)} з ${nf.format(st.frames.length)}${list.length > shown.length ? ` · показано останні ${MAX_ROWS}` : ''}`;
  $('frameBody').innerHTML = shown.map(f => {
    const c = cmdOf(f);
    return `<tr data-id="${f.id}" class="${st.selId === f.id ? 'sel' : ''}">
      <td class="n">${f.id}</td><td class="n">${relSec(f.ts)}</td>
      <td class="${f.dir}">${f.dir === 'out' ? '↑' : '↓'}</td><td>${typeName(f.type)}</td>
      <td class="mono">${hex4(c)}</td><td>${esc(cmdName(c))}</td>
      <td class="n">${f.seq ?? ''}</td><td class="n">${nf.format(f.len)}</td>
      <td class="prev">${esc(preview(f))}</td></tr>`;
  }).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function renderTree(m: PbField[], prefix: string, depth: number, q: string): string {
  const counts = new Map<number, number>();
  for (const x of m) counts.set(x.f, (counts.get(x.f) ?? 0) + 1);
  const idx = new Map<number, number>();
  return m.map(x => {
    const i = idx.get(x.f) ?? 0;
    idx.set(x.f, i + 1);
    const key = counts.get(x.f)! > 1 ? `${x.f}[${i}]` : String(x.f);
    const path = prefix ? `${prefix}.${x.f}` : String(x.f);
    const k = `<span class="k" data-path="${path}" title="Клік — копіювати шлях ${path}">${key}</span>`;
    if (isMsg(x.v)) {
      const hit = Boolean(q) && msgHit(x.v.m, q);
      const open = (depth <= 1 && m.length <= 30) || hit;
      return `<details ${open ? 'open' : ''}><summary>${k} <span class="t">{${x.v.m.length}}</span> <span class="sum">${esc(summary(x.v.m))}</span></summary>`
        + `<div class="kids">${renderTree(x.v.m, path, depth + 1, q)}</div></details>`;
    }
    return `<div class="leaf ${q && leafHit(x.v, q) ? 'hit' : ''}">${k} ${fmtLeaf(x.v)}</div>`;
  }).join('');
}

function renderDetail(): void {
  const el = $('detail');
  const f = st.selId === null ? undefined : st.byId.get(st.selId);
  if (!f) {
    el.innerHTML = '<div class="empty">Вибери кадр. ↑ — від гри до сервера, ↓ — від сервера. Клік по номеру поля копіює його шлях (напр. 1.14.26).</div>';
    return;
  }
  const c = cmdOf(f);
  const pair = (f.type === 0 || f.type === 1) && f.seq
    ? st.frames.find(x => x.seq === f.seq && x.dir !== f.dir && x.cmd === f.cmd)
    : undefined;
  el.innerHTML = `<div class="dhead">
      <b>#${f.id}</b> ${f.dir === 'out' ? '↑ від гри' : '↓ від сервера'} · ${typeName(f.type)} ·
      <span class="mono">${hex4(c)}</span> (${c === NO_CMD ? '' : c}) <b>${esc(cmdName(c))}</b><br>
      seq ${f.seq ?? '—'} · ${nf.format(f.len)} байт · +${relSec(f.ts)} с · ${new Date(f.ts).toLocaleTimeString('uk-UA')}
      ${pair ? ` · пара: <a data-goto="${pair.id}">#${pair.id} (${typeName(pair.type)})</a>` : ''}<br>
      <button id="copyJson">Копіювати JSON</button><button id="onlyCmd">Тільки ця команда</button>
    </div>
    <div class="tree">${f.m ? (f.m.length ? renderTree(f.m, '', 0, st.q) : '<i>порожнє тіло</i>') : `<div class="h">${esc(f.hex ?? '')}</div>`}</div>`;
}

let rafPending = false;
function render(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    renderCmds();
    renderFrames();
  });
}

function setStatus(text: string, err = false): void {
  const s = $('status');
  s.textContent = text;
  s.classList.toggle('err', err);
}

function toast(text: string): void {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  window.setTimeout(() => t.classList.remove('show'), 1200);
}

// ---------- Дані ----------
function reset(session?: number): void {
  st.session = session;
  st.since = 0;
  st.lost = 0;
  st.frames = [];
  st.byId.clear();
  previews.clear();
  st.selId = null;
  renderDetail();
}


async function poll(): Promise<void> {
  st.tabId ??= await findGameTab();
  if (st.tabId == null) return setStatus('Вкладку гри не знайдено — відкрий topeleven.com/play', true);

  let got = 0;
  for (let guard = 0; guard < 50; guard++) {
    let r: FramesReply | undefined;
    try {
      r = await chrome.tabs.sendMessage(st.tabId, { cmd: 'frames', since: st.since } satisfies ViewerRequest) as FramesReply | undefined;
    } catch {
      st.tabId = undefined;
      forgetGameTab();
      return setStatus('Нема зв’язку з грою — онови вкладку гри (F5)', true);
    }
    if (!r) return setStatus('Гра не відповіла', true);
    if (r.session !== st.session) {
      // гру перезавантажили — починаємо з нуля, щоб бачити завантаження з початку
      reset(r.session);
      if (r.firstId > 0 || r.frames[0]?.id !== 0) continue;
    }
    if (r.firstId > st.since) st.lost += r.firstId - st.since;
    for (const f of r.frames) {
      st.frames.push(f);
      st.byId.set(f.id, f);
    }
    got += r.frames.length;
    st.since = r.nextId;
    if (!r.more) break;
  }
  if (got) render();
  setStatus(`кадрів ${nf.format(st.frames.length)}${st.lost ? ` · втрачено ${st.lost} (переповнення буфера)` : ''} · ${st.live ? 'live' : 'пауза'}`);
}

let timer: number | undefined;
async function loop(): Promise<void> {
  window.clearTimeout(timer);
  await poll();
  if (st.live) timer = window.setTimeout(() => void loop(), POLL_MS);
}

// ---------- Налаштування (назви / приховані) ----------
async function loadPrefs(): Promise<void> {
  const s = await chrome.storage.local.get(['cmdNames', 'cmdHidden']);
  st.names = (s.cmdNames as Record<string, string> | undefined) ?? {};
  st.hidden = new Set((s.cmdHidden as number[] | undefined) ?? []);
}
const saveNames = () => chrome.storage.local.set({ cmdNames: st.names });
const saveHidden = () => chrome.storage.local.set({ cmdHidden: [...st.hidden] });

// ---------- Події ----------
$('cmdBody').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.tagName === 'INPUT') return;
  const tr = t.closest<HTMLTableRowElement>('tr[data-cmd]');
  if (!tr) return;
  const c = Number(tr.dataset.cmd);
  st.selCmd = st.selCmd === c ? null : c;
  renderCmds();
  renderFrames();
});

$('cmdBody').addEventListener('change', e => {
  const t = e.target as HTMLInputElement;
  const c = Number(t.dataset.cmd);
  if (t.classList.contains('show')) {
    if (t.checked) st.hidden.delete(c); else st.hidden.add(c);
    void saveHidden();
  } else if (t.classList.contains('name')) {
    const v = t.value.trim();
    if (v) st.names[c] = v; else delete st.names[c];
    void saveNames();
    t.blur();
  }
  render();
  renderDetail();
});
$('cmdBody').addEventListener('keydown', e => {
  if (e.key === 'Enter') (e.target as HTMLElement).blur();
});

$('frameBody').addEventListener('click', e => {
  const tr = (e.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-id]');
  if (!tr) return;
  st.selId = Number(tr.dataset.id);
  for (const r of $('frameBody').querySelectorAll('tr.sel')) r.classList.remove('sel');
  tr.classList.add('sel');
  renderDetail();
});

$('detail').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.classList.contains('k')) {
    e.preventDefault();
    void navigator.clipboard.writeText(t.dataset.path ?? '').then(() => toast(`Шлях ${t.dataset.path} скопійовано`));
    return;
  }
  if (t.dataset.goto) {
    st.selId = Number(t.dataset.goto);
    renderFrames();
    renderDetail();
    return;
  }
  const f = st.selId === null ? undefined : st.byId.get(st.selId);
  if (!f) return;
  if (t.id === 'copyJson') void navigator.clipboard.writeText(JSON.stringify(f)).then(() => toast('JSON скопійовано'));
  if (t.id === 'onlyCmd') {
    st.selCmd = cmdOf(f);
    render();
  }
});

let qTimer: number | undefined;
$<HTMLInputElement>('q').addEventListener('input', e => {
  window.clearTimeout(qTimer);
  qTimer = window.setTimeout(() => {
    st.q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    renderFrames();
    renderDetail();
  }, 250);
});

$<HTMLSelectElement>('dir').addEventListener('change', e => {
  st.dir = (e.target as HTMLSelectElement).value as typeof st.dir;
  renderFrames();
});

$('live').addEventListener('click', () => {
  st.live = !st.live;
  $('live').className = st.live ? 'on' : '';
  if (st.live) void loop(); else window.clearTimeout(timer);
});

$('clear').addEventListener('click', () => {
  // нові кадри підтягуватимуться далі з поточного місця
  const since = st.since, session = st.session;
  reset(session);
  st.since = since;
  render();
});

$('export').addEventListener('click', () => {
  const frames = visible();
  const names: Record<string, string> = {};
  for (const f of frames) { const c = cmdOf(f); if (cmdName(c)) names[hex4(c)] = cmdName(c); }
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), session: st.session, names, frames }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `t11-traffic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Вкладки сторінки ----------
const VIEWS = ['auction', 'squad', 'traffic'] as const;
type View = typeof VIEWS[number];
function setView(v: View): void {
  document.body.dataset.view = v;
  for (const el of document.querySelectorAll<HTMLElement>('[data-for]')) el.hidden = el.dataset.for !== v;
  try { localStorage.setItem('view', v); } catch { /* ignore */ }
  for (const b of document.querySelectorAll<HTMLButtonElement>('nav button')) b.classList.toggle('active', b.dataset.view === v);
  if (location.hash !== `#${v}`) history.replaceState(null, '', `${location.search}#${v}`);
}
document.querySelector('nav')!.addEventListener('click', e => {
  const v = (e.target as HTMLElement).dataset.view as View | undefined;
  if (v) setView(v);
});
const fromHash = location.hash.slice(1) as View;
let saved: string | null = null;
try { saved = localStorage.getItem('view'); } catch { /* ignore */ }
setView(VIEWS.includes(fromHash) ? fromHash : VIEWS.includes(saved as View) ? saved as View : 'auction');
initSquadView();
initAuctionView();

void loadPrefs().then(() => { renderDetail(); void loop(); });
