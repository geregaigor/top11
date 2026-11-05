// Код, що оновлюється з сайту (payload): inject.js (гра), viewer.js + viewer.html (сторінка розширення).
// Оболонка (пакет) лише качає, перевіряє підпис і запускає.

export const PAYLOAD_FILES = ['inject.js', 'viewer.js', 'viewer.html'] as const;

/** Підписаний опис версії: що лежить на сайті */
export interface CodeManifest {
  version: string;
  built: string;
  /** імʼя файлу -> sha256 (base64) */
  files: Record<string, string>;
  /** Версія оболонки (пакета): latest — остання опублікована, min — потрібна для цього коду */
  shell?: { latest: string; min: string; /** файли оболонки: шлях -> sha256 (лежать у <code>/shell/) */ files?: Record<string, string> };
}

/** Сторінка на сайті зі встановленням розширення та інструкцією */
export const SITE_EXT_PAGE = '/ext';

/** Активний код у chrome.storage */
export interface CodePack {
  version: string;
  source: 'bundled' | 'site';
  /** Час збірки (для локального режиму: перезбірка без зміни версії теж підхоплюється) */
  built?: string;
  files: Record<string, string>;
  installedAt: number;
}

export interface UpdaterConfig {
  /** site — код з сайту (підписаний); local — з папки dist/payload розширення (розробка, npm run watch) */
  mode: 'site' | 'local';
  /** Адреса сайту, з якого тягнемо <base>/ext/code/payload.json */
  base: string;
  /** Перевіряти самому кожні 15 хв */
  auto: boolean;
}
export const DEFAULT_UPDATER: UpdaterConfig = { mode: 'site', base: 'https://top11.tryasp.net', auto: true };
/** Сайти, з яких можна брати код (вибір у прихованих dev-налаштуваннях) */
export const CODE_SITES = [
  { base: 'https://top11.tryasp.net', label: 'Сайт top11.tryasp.net' },
] as const;

/** Шлях до коду на сайті (сам /ext лишається під сторінку про розширення) */
export const CODE_PATH = '/ext/code';

export interface UpdaterStatus {
  ts: number;
  ok: boolean;
  text: string;
  /** chrome.userScripts доступний (увімкнено «Allow User Scripts») */
  userScripts: boolean;
  remoteVersion?: string;
  /** Остання версія оболонки на сайті (якщо новіша за встановлену — банер «онови розширення») */
  shellLatest?: string;
}

/** Команди сторінки-обгортки до background */
export type CodeCommand =
  | { cmd: 'codeCheck' }
  | { cmd: 'codeEnsure' }
  | { cmd: 'shellFetch' }
  | { cmd: 'openViewer' }
  | { cmd: 'pageLoaded' };

/** Відповідь shellFetch: перевірені (підпис + sha256) файли нової оболонки */
export interface ShellFiles {
  ok: boolean;
  error?: string;
  version?: string;
  /** шлях -> вміст у base64 (бінарно-безпечно: є PNG-іконки) */
  files?: Record<string, string>;
}

export function cmpVer(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const c of u8) s += String.fromCharCode(c);
  return btoa(s);
}
export function unb64(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return buf;
}

/** sha256 сирих байтів (для бінарних файлів оболонки: іконки) */
export async function sha256Bytes(buf: ArrayBuffer): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', buf));
}

export async function sha256(text: string): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
