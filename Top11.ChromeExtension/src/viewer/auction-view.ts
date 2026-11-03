// Вкладка «Аукціон» (колишній попап): фільтри, старт/стоп, поточний скан, знайдені.
import { DEFAULT_SETTINGS, loadHistory, loadState, type AuctionPlayer, type PopupCommand, type ScanResult, type Settings } from '../shared/messages';
import { findGameTab, forgetGameTab } from './game-tab';
import { auctionOvr, expectedValue } from '../shared/value';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
const fmtPrice = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`);
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** Очікувана вартість за віком і ОБЩ + відхилення ціни від неї */
function expectedCells(p: AuctionPlayer): string {
  if (!p.skillAvg || !p.price) return '<td class="n">—</td><td class="n">—</td>';
  const exp = expectedValue(p.age, auctionOvr(p.skillAvg));
  const d = (p.price / exp - 1) * 100;
  const cls = d >= 10 ? 'over' : d <= -10 ? 'under' : '';
  return `<td class="n t">${fmtPrice(exp)}</td><td class="n ${cls}">${d >= 0 ? '+' : ''}${d.toFixed(0)}%</td>`;
}

/** Очікувана, Δ, З/П і К; у старих записах історії частини полів нема */
const extraCells = (p: AuctionPlayer) =>
  expectedCells(p) + `<td class="n">${p.price2 ? fmtPrice(p.price2) : '—'}</td><td class="n">${p.lotFactor ? p.lotFactor.toFixed(2) : '—'}</td>`;

let inputs: Record<keyof Settings, HTMLInputElement>;

function renderScan(scan?: ScanResult): void {
  $('scanMeta').textContent = scan
    ? `Скан ${new Date(scan.ts).toLocaleTimeString()}: ${scan.total} гравців, зараз під фільтр ${scan.matches.length}`
    : 'Сканів ще не було';
  const players = [...(scan?.players ?? [])].sort((a, b) => a.age - b.age || a.quality - b.quality);
  const matchIds = new Set(scan?.matches.map(p => p.id));
  $('currentCount').textContent = String(players.length);
  $('current').innerHTML = players
    .map(p => `<tr class="${matchIds.has(p.id) ? 'match' : ''}"><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.positions.join(' '))}</td><td class="n">${p.age}</td><td class="n">${p.quality}%</td><td class="n">${fmtPrice(p.price)}</td>${extraCells(p)}<td class="c">${p.hasSpecial ? '✓' : ''}</td><td class="c">${p.hasStyle ? '✓' : ''}</td></tr>`)
    .join('');
}

/** Збережений список (не зникає, коли гравець пропадає з аукціону). Нові зверху. */
async function renderHistory(): Promise<void> {
  const list = Object.values(await loadHistory()).sort((a, b) => b.firstSeen - a.firstSeen);
  $('historyCount').textContent = String(list.length);
  $('history').innerHTML = list
    .map(({ player: p, firstSeen }) => `<tr><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.positions.join(' '))}</td><td class="n">${p.age}</td><td class="n">${p.quality}%</td><td class="n">${fmtPrice(p.price)}</td>${extraCells(p)}<td class="c">${p.hasStyle ? '✓' : ''}</td><td class="n t">${new Date(firstSeen).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td></tr>`)
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

async function renderState(): Promise<void> {
  const { running, settings, lastScan } = await loadState();
  writeInputs(settings);
  const toggle = $<HTMLButtonElement>('toggle');
  toggle.textContent = running ? 'Стоп' : 'Старт аукціон';
  toggle.className = running ? 'stop' : 'start';
  $('aStatus').textContent = await linkStatus();
  renderScan(lastScan);
}

const saveSettings = () => chrome.storage.local.set({ settings: readInputs() });

/** Перевіряє, що на вкладці гри живий content script (після ↻ розширення без F5 гри він мертвий). */
async function linkStatus(): Promise<string> {
  const tabId = await findGameTab();
  if (tabId == null) return 'Вкладку з грою не знайдено — відкрий topeleven.com/play';
  try {
    const r = await chrome.tabs.sendMessage(tabId, { cmd: 'ping' } satisfies PopupCommand) as { ok?: boolean } | undefined;
    if (r?.ok) return '';
  } catch { /* нема отримувача */ }
  forgetGameTab();
  return 'Розширення оновлено, а вкладка гри ні — натисни F5 на вкладці гри, інакше Старт не спрацює';
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

  $('toggle').onclick = async () => {
    const { running } = await loadState();
    await saveSettings();
    await chrome.storage.local.set({ running: !running });
    await renderState();
  };
  $('scanNow').onclick = () => void send('scanNow');
  $('beep').onclick = () => void send('beep');
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
    if ('lastScan' in changes) renderScan(changes.lastScan?.newValue as ScanResult | undefined);
    if ('history' in changes) void renderHistory();
    if ('running' in changes) void renderState();
  });

  $('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  // статус зв'язку з грою оновлюємо періодично (F5 гри, закрита вкладка тощо)
  window.setInterval(() => void linkStatus().then(s => { $('aStatus').textContent = s; }), 5000);
  void renderHistory();
  void renderState();
}
