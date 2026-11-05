// «Оновити розширення» без zip: сторінка розширення пише нові файли оболонки прямо в папку,
// з якої Chrome завантажив розширення (File System Access API), і перезапускає розширення.
import { unb64, type CodeCommand, type ShellFiles } from '../shared/codepack';

// File System Access — немає в lib.dom TS 5.4
type Perm = 'granted' | 'denied' | 'prompt';
interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<Perm>;
  requestPermission(d: { mode: 'readwrite' }): Promise<Perm>;
}
declare global {
  interface Window { showDirectoryPicker(o?: { id?: string; mode?: 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle> }
}

const DB = 't11-self-update';

function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return new Promise((res, rej) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('h');
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('h', mode);
      const req = fn(tx.objectStore('h'));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    };
  });
}
const loadDir = () => idb<DirHandle | undefined>(s => s.get('dir') as IDBRequest<DirHandle | undefined>, 'readonly').catch(() => undefined);
const saveDir = (h: FileSystemDirectoryHandle) => idb(s => s.put(h, 'dir'), 'readwrite');
const forgetDir = () => idb(s => s.delete('dir'), 'readwrite').catch(() => undefined);

/** Це точно папка цього розширення: manifest.json з тим самим name і версією, що працює зараз */
async function isOurFolder(dir: FileSystemDirectoryHandle): Promise<string | null> {
  try {
    const f = await (await dir.getFileHandle('manifest.json')).getFile();
    const m = JSON.parse(await f.text()) as { name?: string; version?: string };
    const me = chrome.runtime.getManifest();
    if (m.name !== me.name) return `У вибраній папці інше розширення (${m.name ?? '?'})`;
    if (m.version !== me.version) return `У вибраній папці версія ${m.version}, а працює ${me.version} — це інша копія? Вибери папку, з якої завантажено розширення`;
    return null;
  } catch {
    return 'У вибраній папці нема manifest.json — вибери папку, куди розпаковано розширення (де лежать manifest.json, background.js…)';
  }
}

async function writeFile(root: FileSystemDirectoryHandle, path: string, data: ArrayBuffer): Promise<void> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

/** Викликати з кліку (потрібна взаємодія користувача для вибору папки / дозволу) */
export async function selfUpdate(say: (t: string) => void): Promise<void> {
  // 1) папка (і дозвіл) — одразу, поки діє клік
  let dir = await loadDir();
  if (dir && await dir.queryPermission({ mode: 'readwrite' }) !== 'granted') {
    if (await dir.requestPermission({ mode: 'readwrite' }) !== 'granted') { say('Без дозволу на папку оновити не вийде'); return; }
  }
  if (!dir) {
    try {
      dir = await window.showDirectoryPicker({ id: 't11-ext', mode: 'readwrite' }) as DirHandle;
    } catch {
      say('Папку не вибрано');
      return;
    }
  }
  const bad = await isOurFolder(dir);
  if (bad) { await forgetDir(); say(bad); return; }
  await saveDir(dir);

  // 2) перевірені файли з сайту
  say('Завантажую…');
  const r = await chrome.runtime.sendMessage({ cmd: 'shellFetch' } satisfies CodeCommand) as ShellFiles | undefined;
  if (!r?.ok || !r.files) { say(r?.error ?? 'Не вдалось отримати файли'); return; }

  // 3) запис: manifest.json останнім — щоб недописане оновлення не змінило версію
  const paths = Object.keys(r.files).sort((a, b) => Number(a === 'manifest.json') - Number(b === 'manifest.json'));
  try {
    for (const p of paths) {
      say(`Записую ${p}…`);
      await writeFile(dir, p, unb64(r.files[p]!));
    }
  } catch (e) {
    say(`Помилка запису: ${(e as Error).message}`);
    return;
  }
  say(`Готово (${r.version}) — перезапускаю розширення, потім F5 гри`);
  setTimeout(() => chrome.runtime.reload(), 800);
}
