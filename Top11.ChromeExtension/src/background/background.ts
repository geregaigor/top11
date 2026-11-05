// Оболонка: клік по іконці + завантаження/перевірка/запуск коду з сайту.
import {
  CODE_PATH, DEFAULT_UPDATER, PAYLOAD_FILES, b64, cmpVer, sha256, sha256Bytes, unb64,
  type CodeCommand, type CodeManifest, type CodePack, type ShellFiles, type UpdaterConfig, type UpdaterStatus,
} from '../shared/codepack';
import { PUBLIC_KEY_JWK } from '../shell/pubkey';

const PAGE = chrome.runtime.getURL('viewer.html');
const GAME = 'https://www.topeleven.com/play';
const SCRIPT_ID = 't11-inject';
const ALARM = 't11-code-check';

chrome.action.onClicked.addListener(tab => void openViewer(tab));

/** Сторінка розширення: перемкнути на відкриту або відкрити поруч із вкладкою (гри) */
async function openViewer(tab?: chrome.tabs.Tab): Promise<void> {
  const [ctx] = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  const existing = ctx && ctx.tabId >= 0 ? await chrome.tabs.get(ctx.tabId).catch(() => undefined) : undefined;
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  const game = tab?.url?.startsWith(GAME) ? `?tab=${tab.id}` : '';
  await chrome.tabs.create({ url: PAGE + game, index: tab ? tab.index + 1 : undefined, windowId: tab?.windowId });
}

// ---------- код ----------

async function loadBundled(): Promise<CodePack> {
  const url = (f: string) => chrome.runtime.getURL('payload/' + f);
  const m = await (await fetch(url('payload.json'))).json() as CodeManifest;
  const files: Record<string, string> = {};
  for (const f of PAYLOAD_FILES) files[f] = await (await fetch(url(f))).text();
  return { version: m.version, source: 'bundled', built: m.built, files, installedAt: Date.now() };
}

async function getCode(): Promise<{ code?: CodePack }> {
  return await chrome.storage.local.get('code') as { code?: CodePack };
}

async function getConfig(): Promise<UpdaterConfig> {
  const { updater } = await chrome.storage.local.get('updater');
  return { ...DEFAULT_UPDATER, ...(updater as Partial<UpdaterConfig> | undefined) };
}

async function setStatus(s: Omit<UpdaterStatus, 'ts' | 'userScripts'>): Promise<UpdaterStatus> {
  const st: UpdaterStatus = { ...s, ts: Date.now(), userScripts: await userScriptsOk() };
  await chrome.storage.local.set({ updaterStatus: st });
  return st;
}

/** Chrome 138+: працює лише з увімкненим «Allow User Scripts» у деталях розширення; раніше — з режимом розробника */
async function userScriptsOk(): Promise<boolean> {
  try {
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

/** Реєструє inject.js активної версії як user script (MAIN world, document_start, без обмежень CSP гри) */
async function registerInject(code: CodePack): Promise<boolean> {
  if (!await userScriptsOk()) return false;
  const script = {
    id: SCRIPT_ID,
    matches: [`${GAME}/*`],
    js: [{ code: code.files['inject.js'] ?? '' }],
    runAt: 'document_start' as const,
    world: 'MAIN' as const,
  };
  const existing = await chrome.userScripts.getScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.userScripts.update([script]);
  else await chrome.userScripts.register([script]);
  await chrome.storage.local.set({ registeredKey: codeKey(code) });
  return true;
}

async function activate(pack: CodePack): Promise<void> {
  const { code } = await getCode();
  const patch: Record<string, unknown> = { code: pack };
  await chrome.storage.local.set(patch);
  await registerInject(pack);
}

const codeKey = (c: CodePack) => `${c.source}:${c.version}:${c.built ?? ''}`;

/**
 * Активний код є і зареєстрований.
 * local: завжди код з dist/payload (unpacked-розширення читає файли з диска наживо — npm run watch підхоплюється без ↻).
 * site: код з сайту; вбудований — лише якщо ще нічого не скачано.
 */
async function ensure(): Promise<UpdaterStatus> {
  const { mode } = await getConfig();
  let { code } = await getCode();
  if (mode === 'local') {
    const bundled = await loadBundled();
    if (!code || codeKey(code) !== codeKey(bundled)) {
      await activate(bundled);
      code = bundled;
      await setStatus({ ok: true, text: `Локальна збірка ${bundled.version} · ${new Date(bundled.built ?? Date.now()).toLocaleTimeString()} — F5 гри` });
    }
  } else if (!code) {
    code = await loadBundled();
    await activate(code);
  }
  const { registeredKey } = await chrome.storage.local.get('registeredKey');
  if (await userScriptsOk()) {
    const has = (await chrome.userScripts.getScripts({ ids: [SCRIPT_ID] })).length > 0;
    if (!has || registeredKey !== codeKey(code)) await registerInject(code);
  }
  const { updaterStatus } = await chrome.storage.local.get('updaterStatus');
  const prev = updaterStatus as UpdaterStatus | undefined;
  // текст останньої перевірки лишаємо; про user scripts сторінка показує окремий банер
  return setStatus({ ok: prev?.ok ?? true, text: prev?.text ?? `Код ${code.version}`, remoteVersion: prev?.remoteVersion, shellLatest: prev?.shellLatest });
}

async function verify(manifest: string, sig: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('jwk', PUBLIC_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(sig), new TextEncoder().encode(manifest));
}

let checking: Promise<UpdaterStatus> | null = null;
function check(): Promise<UpdaterStatus> {
  checking ??= doCheck().finally(() => { checking = null; });
  return checking;
}

async function doCheck(): Promise<UpdaterStatus> {
  const { base, mode } = await getConfig();
  if (mode === 'local') {
    await chrome.storage.local.remove('updaterStatus');
    const st = await ensure();
    const { code } = await getCode();
    return setStatus({ ok: true, text: `Локальна збірка ${code?.version} (dist/payload)`, remoteVersion: st.remoteVersion });
  }
  const root = base.replace(/\/+$/, '') + CODE_PATH;
  try {
    await ensure();
    const r = await fetch(`${root}/payload.json`, { cache: 'no-store' });
    if (!r.ok) return setStatus({ ok: false, text: `Сайт: ${r.status} ${r.statusText}` });
    const { manifest, sig } = await r.json() as { manifest: string; sig: string };
    if (!await verify(manifest, sig)) return setStatus({ ok: false, text: 'Підпис коду на сайті НЕ збігається — не встановлюю' });
    const m = JSON.parse(manifest) as CodeManifest;
    const shellLatest = m.shell?.latest;
    const mine = chrome.runtime.getManifest().version;
    const { code } = await getCode();
    // код потребує новішої оболонки — не ставимо, лишаємось на поточному
    if (m.shell && cmpVer(m.shell.min, mine) > 0) {
      return setStatus({ ok: false, text: `Код ${m.version} потребує нової версії розширення (${m.shell.min}) — онови розширення`, remoteVersion: m.version, shellLatest });
    }
    // з сайту: оновлюємось, якщо там новіша версія або зараз працює не сайтовий код (після локального режиму)
    if (code?.source === 'site' && cmpVer(m.version, code.version) <= 0) {
      return setStatus({ ok: true, text: `Актуальна (${code.version}), на сайті ${m.version}`, remoteVersion: m.version, shellLatest });
    }
    const files: Record<string, string> = {};
    for (const f of PAYLOAD_FILES) {
      const fr = await fetch(`${root}/shell/payload/${f}`, { cache: 'no-store' });
      if (!fr.ok) return setStatus({ ok: false, text: `Не завантажився ${f}: ${fr.status}`, shellLatest });
      const text = await fr.text();
      if (await sha256(text) !== m.files[f]) return setStatus({ ok: false, text: `Хеш ${f} не збігається — не встановлюю`, shellLatest });
      files[f] = text;
    }
    await activate({ version: m.version, source: 'site', files, installedAt: Date.now() });
    return setStatus({ ok: true, text: `Оновлено до ${m.version} — F5 гри, щоб підхопила`, remoteVersion: m.version, shellLatest });
  } catch (e) {
    return setStatus({ ok: false, text: `Сайт недоступний: ${(e as Error).message}` });
  }
}

/** Файли нової оболонки з сайту — лише після перевірки підпису payload.json і sha256 кожного файлу */
async function shellFetch(): Promise<ShellFiles> {
  const { base } = await getConfig();
  const root = base.replace(/\/+$/, '') + CODE_PATH;
  try {
    const r = await fetch(`${root}/payload.json`, { cache: 'no-store' });
    if (!r.ok) return { ok: false, error: `Сайт: ${r.status}` };
    const { manifest, sig } = await r.json() as { manifest: string; sig: string };
    if (!await verify(manifest, sig)) return { ok: false, error: 'Підпис на сайті не збігається' };
    const m = JSON.parse(manifest) as CodeManifest;
    if (!m.shell?.files) return { ok: false, error: 'На сайті нема файлів оболонки' };
    const files: Record<string, string> = {};
    for (const [path, hash] of Object.entries(m.shell.files)) {
      if (path.includes('..') || path.startsWith('/')) return { ok: false, error: `Дивний шлях ${path}` };
      const fr = await fetch(`${root}/shell/${path}`, { cache: 'no-store' });
      if (!fr.ok) return { ok: false, error: `Не завантажився ${path}: ${fr.status}` };
      const buf = await fr.arrayBuffer(); // байти: серед файлів оболонки є PNG
      if (await sha256Bytes(buf) !== hash) return { ok: false, error: `Хеш ${path} не збігається` };
      files[path] = b64(buf);
    }
    return { ok: true, version: m.shell.latest, files };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Гру щойно відкрили/оновили: перевіряємо код. Якщо поставили нову версію — один раз перезавантажуємо вкладку,
 * бо ця сторінка вже стартувала зі старим кодом (гра ще не встигла підключитись, нічого не втрачається).
 */
let lastGameCheck = 0;
async function onGameLoaded(tabId?: number): Promise<void> {
  if (Date.now() - lastGameCheck < 30_000) return; // F5 підряд і наше ж перезавантаження — без повторів
  lastGameCheck = Date.now();
  const before = (await getCode()).code;
  await check();
  const after = (await getCode()).code;
  if (tabId != null && after && (!before || codeKey(before) !== codeKey(after))) {
    await chrome.tabs.reload(tabId).catch(() => undefined);
  }
}



chrome.runtime.onMessage.addListener((msg: CodeCommand, sender, reply) => {
  if (msg?.cmd === 'pageLoaded') {
    void onGameLoaded(sender.tab?.id);
    return false;
  }
  if (msg?.cmd === 'openViewer') {
    void openViewer(sender.tab);
    return false;
  }
  if (msg?.cmd === 'shellFetch') {
    shellFetch().then(reply);
    return true;
  }
  const run = msg?.cmd === 'codeCheck' ? check
    : msg?.cmd === 'codeEnsure' ? ensure
    : null;
  if (!run) return false;
  run().then(reply, e => reply({ ok: false, text: String(e), ts: Date.now(), userScripts: false }));
  return true;
});

chrome.alarms.onAlarm.addListener(async a => {
  if (a.name === ALARM) void check(); // завжди: у людей оновлення не вимикаються
});

async function start(): Promise<void> {
  await chrome.storage.local.remove(['codePrev', 'navPoints', 'navStatus', 'running']); // залишки прибраних функцій
  await chrome.alarms.create(ALARM, { periodInMinutes: 15 });
  await ensure();
  void check();
}
chrome.runtime.onInstalled.addListener(() => void start());
chrome.runtime.onStartup.addListener(() => void start());
