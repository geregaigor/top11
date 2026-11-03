import { DEFAULT_SETTINGS, loadHistory, loadState, type AuctionPlayer, type PopupCommand, type ScanResult, type Settings } from '../shared/messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
const inputs = Object.fromEntries(keys.map(k => [k, $<HTMLInputElement>(k)])) as Record<keyof Settings, HTMLInputElement>;
const toggle = $<HTMLButtonElement>('toggle');
const status = $<HTMLDivElement>('status');
const scanMeta = $<HTMLDivElement>('scanMeta');
const historyEl = $<HTMLTableSectionElement>('history');

const fmtPrice = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** Ц2 і К; у старих записах історії цих полів нема */
const extraCells = (p: AuctionPlayer) =>
  `<td class="n">${p.price2 ? fmtPrice(p.price2) : '—'}</td><td class="n">${p.lotFactor ? p.lotFactor.toFixed(2) : '—'}</td>`;

async function gameTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url?.startsWith('https://www.topeleven.com/play') ? tab : null;
}

function renderScan(scan?: ScanResult): void {
  scanMeta.textContent = scan
    ? `Скан ${new Date(scan.ts).toLocaleTimeString()}: ${scan.total} гравців, зараз під фільтр ${scan.matches.length}`
    : '';
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
  historyEl.innerHTML = list
    .map(({ player: p }) => `<tr><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.positions.join(' '))}</td><td class="n">${p.age}</td><td class="n">${p.quality}%</td><td class="n">${fmtPrice(p.price)}</td>${extraCells(p)}<td class="c">${p.hasStyle ? '✓' : ''}</td></tr>`)
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

async function render(): Promise<void> {
  const { running, settings, lastScan } = await loadState();
  writeInputs(settings);
  toggle.textContent = running ? 'Стоп' : 'Старт аукціон';
  toggle.className = running ? 'stop' : 'start';
  status.textContent = (await gameTab()) ? '' : 'Відкрий вкладку з грою (topeleven.com/play)';
  renderScan(lastScan);
}

const saveSettings = () => chrome.storage.local.set({ settings: readInputs() });

async function send(cmd: PopupCommand['cmd']): Promise<void> {
  const tab = await gameTab();
  if (tab?.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { cmd } satisfies PopupCommand);
  } catch {
    // content script ще не підвантажений (напр. після ↻ розширення без F5 гри)
    status.textContent = 'Онови вкладку з грою (F5)';
  }
}

for (const el of Object.values(inputs)) el.onchange = () => void saveSettings();

toggle.onclick = async () => {
  const { running } = await loadState();
  await saveSettings();
  await chrome.storage.local.set({ running: !running });
  await render();
};

$('scanNow').onclick = () => void send('scanNow');
$('beep').onclick = () => void send('beep');
$('dump').onclick = () => void send('dump');
async function openViewer(view: 'squad' | 'traffic'): Promise<void> {
  const tab = await gameTab();
  await chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') + (tab?.id != null ? `?tab=${tab.id}` : '') + `#${view}` });
}
$('traffic').onclick = () => void openViewer('traffic');
$('squad').onclick = () => void openViewer('squad');

chrome.storage.onChanged.addListener(changes => {
  if ('lastScan' in changes) renderScan(changes.lastScan?.newValue as ScanResult | undefined);
});

// Уся історія з сирими полями — в буфер обміну, щоб передати на аналіз
$('copyAll').onclick = async () => {
  const btn = $('copyAll');
  const history = Object.values(await loadHistory());
  const payload = {
    exportedAt: new Date().toISOString(),
    version: chrome.runtime.getManifest().version,
    count: history.length,
    history,
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
    btn.textContent = `Скопійовано (${history.length})`;
  } catch {
    btn.textContent = 'Помилка копіювання';
  }
  window.setTimeout(() => { btn.textContent = 'Копіювати все'; }, 2000);
};

// Підтвердження другим кліком (confirm() у попапі незручний)
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
  if ('history' in changes) void renderHistory();
});
void renderHistory();

// пам'ятаємо, чи розгорнутий блок «Поточні»
const currentBox = $<HTMLDetailsElement>('currentBox');
currentBox.open = localStorage.getItem('currentOpen') === '1';
currentBox.ontoggle = () => localStorage.setItem('currentOpen', currentBox.open ? '1' : '0');

$('ver').textContent = 'v' + chrome.runtime.getManifest().version;
void render();
