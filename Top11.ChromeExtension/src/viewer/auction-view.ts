// Вкладка «Аукціон» (колишній попап): фільтри, старт/стоп, поточний скан, знайдені.
import { DEFAULT_SETTINGS, loadHistory, loadState, type AuctionPlayer, type LiveStatus, type PopupCommand, type ScanResult, type Settings, type WsEvent } from '../shared/messages';
import { findGameTab, forgetGameTab } from './game-tab';
import { auctionOvr, expectedValue } from '../shared/value';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
const fmtPrice = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`);
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** ОБЩ як у грі; у старих записах історії quality рахувався старою формулою — перераховуємо */
const ovrOf = (p: AuctionPlayer) => (p.skillAvg ? auctionOvr(p.skillAvg) : p.quality);

/** Очікувана вартість за віком і ОБЩ + відхилення ціни від неї */
function expectedCells(p: AuctionPlayer): string {
  if (!p.skillAvg || !p.price) return '<td class="n">—</td><td class="n">—</td>';
  const exp = expectedValue(p.age, auctionOvr(p.skillAvg));
  const d = (p.price / exp - 1) * 100;
  const cls = d >= 10 ? 'over' : d <= -10 ? 'under' : '';
  return `<td class="n t">${fmtPrice(exp)}</td><td class="n ${cls}">${d >= 0 ? '+' : ''}${d.toFixed(0)}%</td>`;
}

/** К — талант (множник швидкості тренування): ≥ 1.15 підсвічуємо */
const kCell = (p: AuctionPlayer) => {
  if (!p.lotFactor) return '<td class="n">—</td>';
  const pct = Math.round((p.lotFactor - 1) * 100);
  return `<td class="n ${p.lotFactor >= 1.15 ? 'over' : ''}" title="швидкість тренування ${pct >= 0 ? '+' : ''}${pct}% від К = 1">${p.lotFactor.toFixed(2)}</td>`;
};

/** Прогноз вправ на +1 для 18–21 років з навичками до 80: 11.1 / К (6 замірів, 04.11.2026) */
const drillsCell = (p: AuctionPlayer) => {
  if (!p.lotFactor) return '<td class="n">—</td>';
  const n = 11.1 / p.lotFactor;
  return `<td class="n ${n <= 9.5 ? 'over' : ''}" title="вправ на +1 (прогноз 11.1 / К, для 18–21 р. з навичками до 80)">${n.toFixed(1)}</td>`;
};

/** Очікувана, Δ, З/П, К і прогноз вправ; у старих записах історії частини полів нема */
const extraCells = (p: AuctionPlayer) =>
  expectedCells(p) + `<td class="n">${p.price2 ? fmtPrice(p.price2) : '—'}</td>` + kCell(p) + drillsCell(p);

let inputs: Record<keyof Settings, HTMLInputElement>;

// ---------- Сигнал зі сторінки Top11 (тут був клік «Старт», тож звук дозволений) ----------
let actx: AudioContext | undefined;
const beeped = new Set<number>();

function beep(times = 3): void {
  try {
    actx ??= new AudioContext();
    if (actx.state === 'suspended') void actx.resume();
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
  } catch { /* ignore */ }
}

function beepOnFresh(scan?: ScanResult): void {
  if (!scan || !inputs.sound?.checked) return;
  const fresh = scan.matches.filter(p => !beeped.has(p.id));
  fresh.forEach(p => beeped.add(p.id));
  if (fresh.length) beep();
}

let lastScanTs = 0;
let lastScanText = 'Сканів ще не було';

/** Скільки хвилин тому прийшов список; якщо давно — підказка відкрити екран аукціону */
function renderScanMeta(): void {
  const el = $('scanMeta');
  const min = lastScanTs ? Math.floor((Date.now() - lastScanTs) / 60000) : 0;
  const stale = lastScanTs > 0 && min >= 6;
  el.textContent = lastScanTs
    ? `${lastScanText} · ${min ? `${min} хв тому` : 'щойно'}${stale ? ' — список не оновлюється: відкрий у грі екран аукціону' : ''}`
    : lastScanText;
  el.classList.toggle('stale', stale);
}

function renderScan(scan?: ScanResult): void {
  lastScanTs = scan?.ts ?? 0;
  lastScanText = scan
    ? `Скан ${new Date(scan.ts).toLocaleTimeString()}: ${scan.total} гравців, зараз під фільтр ${scan.matches.length}`
    : 'Сканів ще не було';
  renderScanMeta();
  const players = [...(scan?.players ?? [])].sort((a, b) => a.age - b.age || ovrOf(a) - ovrOf(b));
  const matchIds = new Set(scan?.matches.map(p => p.id));
  $('currentCount').textContent = String(players.length);
  $('current').innerHTML = players
    .map(p => `<tr class="${matchIds.has(p.id) ? 'match' : ''}"><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.positions.join(' '))}</td><td class="n">${p.age}</td><td class="n">${ovrOf(p)}</td><td class="n">${fmtPrice(p.price)}</td>${extraCells(p)}<td class="c">${p.hasSpecial ? '✓' : ''}</td><td class="c">${p.hasStyle ? '✓' : ''}</td></tr>`)
    .join('');
}

/** Збережений список (не зникає, коли гравець пропадає з аукціону). Нові зверху. */
async function renderHistory(): Promise<void> {
  const list = Object.values(await loadHistory()).sort((a, b) => b.firstSeen - a.firstSeen);
  $('historyCount').textContent = String(list.length);
  $('history').innerHTML = list
    .map(({ player: p, firstSeen }) => `<tr><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.positions.join(' '))}</td><td class="n">${p.age}</td><td class="n">${ovrOf(p)}</td><td class="n">${fmtPrice(p.price)}</td>${extraCells(p)}<td class="c">${p.hasStyle ? '✓' : ''}</td><td class="n t">${new Date(firstSeen).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td></tr>`)
    .join('');
}

function writeInputs(s: Settings): void {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'boolean') inputs[k].checked = v;
    else inputs[k].value = String(v);
  }
}

function readInputs(): Settings {
  return Object.fromEntries(keys.map(k => [
    k,
    typeof DEFAULT_SETTINGS[k] === 'boolean' ? inputs[k].checked : Number(inputs[k].value),
  ])) as unknown as Settings;
}

const WS_TEXT: Record<WsEvent['kind'], string> = {
  open: 'зʼєднано', close: 'РОЗРИВ', error: 'помилка сокета', hidden: 'вкладка гри прихована', visible: 'вкладка гри видима',
};

async function renderWsLog(): Promise<void> {
  const { wsLog } = await chrome.storage.local.get('wsLog');
  const list = ((wsLog as WsEvent[] | undefined) ?? []).slice().reverse();
  const closes = list.filter(e => e.kind === 'close');
  const last = closes[0];
  $('wsSummary').textContent = last
    ? `· останній розрив ${new Date(last.ts).toLocaleTimeString()}${last.visible ? '' : ', вкладка була прихована'}`
    : '· розривів не було';
  $('wsLog').innerHTML = list.map(e => {
    const extra = e.kind === 'close'
      ? ` код ${e.code ?? '?'}${e.reason ? ` «${esc(e.reason)}»` : ''} · ${e.visible ? 'вкладка видима' : `прихована ${e.hiddenSec ?? '?'} с`}`
      : '';
    return `<div class="${e.kind}">${new Date(e.ts).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${WS_TEXT[e.kind]}${extra}</div>`;
  }).join('') || '<div class="hidden">Подій ще нема</div>';
}

async function renderState(): Promise<void> {
  const state = await loadState();
  const { settings, lastScan } = state;
  writeInputs(settings);
  $('aStatus').textContent = await linkStatus();
  renderScan(lastScan);
}

const saveSettings = () => chrome.storage.local.set({ settings: readInputs() });

/** Перевіряє, що на вкладці гри живий content script (після ↻ розширення без F5 гри він мертвий). */
async function linkStatus(): Promise<string> {
  const tabId = await findGameTab();
  if (tabId == null) {
    setLed('red', 'Гри не відкрито', 'Вкладку topeleven.com/play не знайдено');
    return 'Вкладку з грою не знайдено — відкрий topeleven.com/play';
  }
  try {
    const r = await chrome.tabs.sendMessage(tabId, { cmd: 'ping' } satisfies PopupCommand) as { ok?: boolean; live?: LiveStatus | null; liveAge?: number | null } | undefined;
    if (r?.ok) { renderLed(r.live ?? null, r.liveAge ?? null); return ''; }
  } catch { /* нема отримувача */ }
  forgetGameTab();
  setLed('red', 'Потрібен F5 гри', 'Розширення оновлено, а сторінка гри ще зі старою версією');
  return 'Розширення оновлено, а вкладка гри ні — натисни F5 на вкладці гри, інакше Старт не спрацює';
}

function setLed(color: 'green' | 'yellow' | 'red', text: string, title: string): void {
  const el = $('link');
  el.className = 'led ' + color;
  $('linkText').textContent = text;
  el.title = title;
}

const ago = (ms: number) => ms < 60_000 ? `${Math.round(ms / 1000)} с` : `${Math.round(ms / 60_000)} хв`;

function renderLed(live: LiveStatus | null, age: number | null): void {
  if (!live || age == null) { setLed('yellow', 'Чекаю гру…', 'Сторінка гри ще не надіслала стан (щойно відкрита?)'); return; }
  const tab = live.hidden ? 'вкладка у фоні' : 'вкладка на екрані';
  if (age > 20_000) { setLed('red', 'Сторінка завмерла', `Немає пульсу ${ago(age)} — ${tab}. Ймовірно, Chrome заморозив вкладку`); return; }
  if (!live.wsOpen) { setLed('red', 'Сесію втрачено', `Сокет гри закрито — ${tab}. Перезайди в гру`); return; }
  const silence = live.lastInTs ? Date.now() - live.lastInTs : null;
  const info = `Сокет відкрито · ${tab}${live.hidden ? (live.keepAlive ? ', не засинає' : ', «Не засинати» вимкнено') : ''}` +
    (silence != null ? ` · останні дані ${ago(silence)} тому` : '');
  if (silence != null && silence > 180_000) { setLed('yellow', `Тиша ${ago(silence)}`, info); return; }
  setLed('green', live.hidden ? 'Звʼязок є (у фоні)' : 'Звʼязок є', info);
}

async function send(cmd: PopupCommand['cmd']): Promise<void> {
  const tabId = await findGameTab();
  if (tabId == null) {
    $('aStatus').textContent = 'Вкладку з грою не знайдено — відкрий topeleven.com/play';
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, { cmd } satisfies PopupCommand);
    $('aStatus').textContent = '';
  } catch {
    forgetGameTab();
    // content script ще не підвантажений (напр. після ↻ розширення без F5 гри)
    $('aStatus').textContent = 'Онови вкладку з грою (F5)';
  }
}

export function initAuctionView(): void {
  inputs = Object.fromEntries(keys.map(k => [k, $<HTMLInputElement>(k)])) as Record<keyof Settings, HTMLInputElement>;
  for (const el of Object.values(inputs)) el.onchange = () => void saveSettings();

  // тест: і в грі, і тут (щоб одразу було видно, де звук працює)
  $('beep').onclick = () => { beep(); void send('beep'); };
  $('dump').onclick = () => void send('dump');

  // Уся історія з сирими полями — в буфер обміну, щоб передати на аналіз
  $('copyAll').onclick = async () => {
    const btn = $('copyAll');
    const history = Object.values(await loadHistory());
    const payload = { exportedAt: new Date().toISOString(), version: chrome.runtime.getManifest().version, count: history.length, history };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      btn.textContent = `Скопійовано (${history.length})`;
    } catch {
      btn.textContent = 'Помилка копіювання';
    }
    window.setTimeout(() => { btn.textContent = 'Копіювати все'; }, 2000);
  };

  // Підтвердження другим кліком
  let clearArmed: number | undefined;
  $('clearHistory').onclick = async () => {
    const btn = $('clearHistory');
    if (clearArmed === undefined) {
      btn.textContent = 'Точно?';
      clearArmed = window.setTimeout(() => { btn.textContent = 'Очистити'; clearArmed = undefined; }, 3000);
      return;
    }
    window.clearTimeout(clearArmed);
    clearArmed = undefined;
    btn.textContent = 'Очистити';
    await chrome.storage.local.remove('history');
  };

  chrome.storage.onChanged.addListener(changes => {
    if ('lastScan' in changes) {
      const scan = changes.lastScan?.newValue as ScanResult | undefined;
      renderScan(scan);
      beepOnFresh(scan);
    }
    if ('history' in changes) void renderHistory();
    if ('wsLog' in changes) void renderWsLog();
  });
  void renderWsLog();

  $('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  // статус зв'язку з грою оновлюємо періодично (F5 гри, закрита вкладка тощо)
  window.setInterval(() => {
    void linkStatus().then(s => { $('aStatus').textContent = s; });
    renderScanMeta();
  }, 3000);
  void renderHistory();
  void renderState();
}
