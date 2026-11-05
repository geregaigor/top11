// Обгортка сторінки розширення: запускає payload у sandbox-iframe і проксує йому chrome.*.
import { CODE_SITES, DEFAULT_UPDATER, SITE_EXT_PAGE, cmpVer, type CodeCommand, type CodePack, type UpdaterConfig, type UpdaterStatus } from '../shared/codepack';
import type { HostMsg, SandboxMsg } from './boot';
import { selfUpdate } from './self-update';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>('app');
let loadedVersion: string | undefined;
let loadedBuilt: string | undefined;
let localMode = false;

/** Що sandbox може викликати (решта chrome.* — ні) */
const ALLOWED = [
  'storage.local.get', 'storage.local.set', 'storage.local.remove',
  'tabs.sendMessage', 'tabs.get', 'tabs.query', 'tabs.update', 'tabs.create',
  'windows.update',
];

function post(m: HostMsg): void { frame.contentWindow?.postMessage(m, '*'); }

function resolve(path: string[]): { fn: (...a: unknown[]) => unknown; self: unknown } | null {
  if (!ALLOWED.includes(path.join('.'))) return null;
  let self: unknown = chrome;
  let cur: unknown = chrome;
  for (const p of path) { self = cur; cur = (cur as Record<string, unknown>)[p]; }
  return typeof cur === 'function' ? { fn: cur as (...a: unknown[]) => unknown, self } : null;
}

async function handleCall(path: string[], args: unknown[]): Promise<unknown> {
  const name = path.join('.');
  if (name === '__ls.set') { localStorage.setItem(String(args[0]), String(args[1])); return; }
  if (name === '__ls.remove') { localStorage.removeItem(String(args[0])); return; }
  if (name === '__clipboard') { await navigator.clipboard.writeText(String(args[0])); return; }
  const r = resolve(path);
  if (!r) throw new Error(`chrome.${name} недоступний у sandbox`);
  return await r.fn.apply(r.self, args);
}

window.addEventListener('message', (e: MessageEvent<SandboxMsg>) => {
  if (e.source !== frame.contentWindow) return;
  const d = e.data;
  if (d?.t === 'ready') void boot();
  else if (d?.t === 'call') {
    handleCall(d.path, d.args).then(
      value => post({ t: 'ret', id: d.id, ok: true, value }),
      err => post({ t: 'ret', id: d.id, ok: false, error: (err as Error)?.message ?? String(err) }),
    );
  } else if (d?.t === 'listen') {
    if (d.path.join('.') === 'storage.onChanged') {
      chrome.storage.onChanged.addListener((changes, area) => post({ t: 'event', id: d.id, args: [changes, area] }));
    }
  }
});

async function boot(): Promise<void> {
  const { code } = await chrome.storage.local.get('code') as { code?: CodePack };
  if (!code) {
    // перший запуск: background ще не поклав код
    await chrome.runtime.sendMessage({ cmd: 'codeEnsure' } satisfies CodeCommand).catch(() => undefined);
    setTimeout(() => location.reload(), 500);
    return;
  }
  loadedVersion = code.version;
  loadedBuilt = code.built;
  const ls: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k != null) ls[k] = localStorage.getItem(k) ?? '';
  }
  post({
    type: 'boot',
    html: code.files['viewer.html'] ?? '',
    js: code.files['viewer.js'] ?? '',
    id: chrome.runtime.id,
    manifest: { ...chrome.runtime.getManifest(), version: code.version },
    ls,
  });
  renderBar();
}

// ---------- смужка оболонки ----------

async function renderBar(): Promise<void> {
  const { code, updater, updaterStatus } = await chrome.storage.local.get(['code', 'updater', 'updaterStatus']) as {
    code?: CodePack; updater?: Partial<UpdaterConfig>; updaterStatus?: UpdaterStatus;
  };
  const cfg = { ...DEFAULT_UPDATER, ...updater };
  $('shellVer').textContent = `Оболонка ${chrome.runtime.getManifest().version}`;
  $('codeVer').textContent = code ? `· Код ${code.version} (${code.source === 'site' ? 'з сайту' : cfg.mode === 'local' ? 'з dist/payload' : 'вбудований'})` : '';
  const st = $('codeStatus');
  st.textContent = updaterStatus ? `· ${updaterStatus.text} · ${new Date(updaterStatus.ts).toLocaleTimeString()}` : '';
  st.className = updaterStatus?.ok ? 'ok' : 'bad';
  localMode = cfg.mode === 'local';
  const src = $<HTMLSelectElement>('codeSource');
  const value = localMode ? 'local|' : `site|${cfg.base}`;
  if (![...src.options].some(o => o.value === value)) src.add(new Option(cfg.base, value)); // адреса, якої нема в списку
  src.value = value;
  // dev-налаштування: 5 кліків по версії, або якщо джерело не прод (щоб не «загубити» перемикач)
  $('devControls').hidden = !devVisible() && value === `site|${DEFAULT_UPDATER.base}`;
  $('shellBar').classList.toggle('local', localMode);
  $('usBanner').hidden = updaterStatus?.userScripts !== false;
  const mine = chrome.runtime.getManifest().version;
  const latest = updaterStatus?.shellLatest;
  const outdated = !localMode && !!latest && cmpVer(latest, mine) > 0;
  $('shellBanner').hidden = !outdated;
  if (outdated) {
    $('shellNew').textContent = latest;
    $('shellMine').textContent = mine;
    $<HTMLAnchorElement>('shellHelp').href = cfg.base.replace(/\/+$/, '') + SITE_EXT_PAGE;
  }
}

async function command(cmd: CodeCommand['cmd']): Promise<void> {
  $('codeStatus').textContent = '· …';
  await chrome.runtime.sendMessage({ cmd } satisfies CodeCommand).catch(() => undefined);
  void renderBar();
}

async function saveConfig(): Promise<void> {
  const { updater } = await chrome.storage.local.get('updater');
  const prev = { ...DEFAULT_UPDATER, ...(updater as Partial<UpdaterConfig> | undefined) };
  const [m, b] = $<HTMLSelectElement>('codeSource').value.split('|');
  const mode = m === 'local' ? 'local' : 'site';
  const base = mode === 'local' ? prev.base : (b || DEFAULT_UPDATER.base);
  if (mode === 'site') {
    try {
      // доступ до сайту для fetch з background (запит дозволу потребує кліку — він тут є)
      await chrome.permissions.request({ origins: [new URL(base).origin + '/*'] });
    } catch { /* top11.tryasp.net уже в host_permissions; інші — optional */ }
  }
  await chrome.storage.local.set({ updater: { mode, base, auto: true } satisfies UpdaterConfig });
  await command('codeCheck'); // перемкнути джерело одразу
}

$('codeSource').onchange = () => void saveConfig();
$('shellUpdate').onclick = async () => {
  const b = $<HTMLButtonElement>('shellUpdate');
  b.disabled = true;
  try { await selfUpdate(t => { $('shellUpdStatus').textContent = t; }); } finally { b.disabled = false; }
};

for (const s of CODE_SITES) $<HTMLSelectElement>('codeSource').add(new Option(s.label, `site|${s.base}`));
$<HTMLSelectElement>('codeSource').add(new Option('Локальна папка dist (розробка)', 'local|'));

// ---------- приховані dev-налаштування: 5 кліків по версії за 2 с ----------
const DEV_KEY = 't11-dev';
function devVisible(): boolean {
  try { return localStorage.getItem(DEV_KEY) === '1'; } catch { return false; }
}
let clicks: number[] = [];
$('shellVer').onclick = () => {
  const now = Date.now();
  clicks = [...clicks.filter(t => now - t < 2000), now];
  if (clicks.length < 5) return;
  clicks = [];
  try { localStorage.setItem(DEV_KEY, devVisible() ? '0' : '1'); } catch { /* */ }
  location.reload(); // сторінка (вкладка «Трафік сокета») теж залежить від dev-режиму
};
$('openExt').onclick = () => void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('code' in changes) {
    const c = changes.code.newValue as CodePack | undefined;
    // нова версія UI (або локальна перезбірка) — перезапуск
    if (loadedVersion && c && (c.version !== loadedVersion || c.built !== loadedBuilt)) { location.reload(); return; }
  }
  if ('updaterStatus' in changes || 'updater' in changes) void renderBar();
});

// поки банер видно — чи увімкнули user scripts; у локальному режимі — чи є нова збірка в dist/payload
setInterval(() => {
  if (localMode || !$('usBanner').hidden) void chrome.runtime.sendMessage({ cmd: 'codeEnsure' } satisfies CodeCommand).catch(() => undefined);
}, 2000);

frame.src = 'app.html' + location.search;
// відкрили сторінку — одразу звіряємо з сайтом (у локальному режимі — з dist)
void chrome.runtime.sendMessage({ cmd: 'codeCheck' } satisfies CodeCommand).catch(() => undefined).then(() => renderBar());
