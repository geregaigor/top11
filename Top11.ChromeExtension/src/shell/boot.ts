/** Дані, які обгортка передає в sandbox-сторінку перед запуском коду */
export interface Boot {
  type: 'boot';
  html: string;
  js: string;
  id: string;
  manifest: chrome.runtime.Manifest;
  /** localStorage обгортки (у sandbox свого нема) */
  ls: Record<string, string>;
}

/** sandbox -> обгортка */
export type SandboxMsg =
  | { t: 'ready' }
  | { t: 'call'; id: number; path: string[]; args: unknown[] }
  | { t: 'listen'; id: number; path: string[] };

/** обгортка -> sandbox */
export type HostMsg =
  | Boot
  | { t: 'ret'; id: number; ok: boolean; value?: unknown; error?: string }
  | { t: 'event'; id: number; args: unknown[] };

declare global { interface Window { __T11_BOOT?: Boot } }
