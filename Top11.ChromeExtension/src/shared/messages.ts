export interface Settings {
  minAge: number;
  maxAge: number;
  minQuality: number;
  maxQuality: number;
  /** Тільки гравці без спецуміння */
  noSpecial: boolean;
  /** Тільки гравці з одним амплуа */
  singlePosition: boolean;
  /** Інтервал оновлення списку аукціону, сек. */
  intervalSec: number;
  /** Калібрування якості: quality = (avgSkill - qZero) / qPerPct */
  qZero: number;
  qPerPct: number;
}

export const DEFAULT_SETTINGS: Settings = {
  minAge: 18,
  maxAge: 19,
  minQuality: 0,
  maxQuality: 50,
  noSpecial: true,
  singlePosition: true,
  intervalSec: 200,
  qZero: 20994,
  qPerPct: 25.23,
};

export interface AuctionPlayer {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  quality: number;
  skillAvg: number;
  price: number;
  /** Сирий код спецуміння (поле 54), NO_SPECIAL = нема */
  special: number;
  hasSpecial: boolean;
  /** Є ігровий стиль (поле 55.2) */
  hasStyle: boolean;
  /** Амплуа: GK, DL, DC, ... */
  positions: string[];
  /** Друга сума (поле 14.27), ~75% від ціни. Значення невідоме — збираємо для аналізу */
  price2: number;
  /** Коефіцієнт лота (поле лота 25.1, double ~0.8–1.13). Значення невідоме — збираємо для аналізу */
  lotFactor: number;
  /** Усі сирі поля лота ["шлях", значення] (без 18 — картинки), для аналізу. Не показуються. */
  raw: [string, string | number][];
}

export interface ScanResult {
  ts: number;
  total: number;
  /** Усі гравці зі скану */
  players: AuctionPlayer[];
  matches: AuctionPlayer[];
}

export interface HistoryEntry {
  player: AuctionPlayer;
  firstSeen: number;
  lastSeen: number;
  timesSeen: number;
  minPrice: number;
  maxPrice: number;
}

/** id гравця -> запис */
export type History = Record<string, HistoryEntry>;

export async function loadHistory(): Promise<History> {
  const { history } = await chrome.storage.local.get('history');
  return (history as History | undefined) ?? {};
}

export interface StoredState {
  running: boolean;
  settings: Settings;
  lastScan?: ScanResult;
}

/** popup -> content (chrome.tabs.sendMessage) */
export type PopupCommand = { cmd: 'beep' } | { cmd: 'dump' } | { cmd: 'scanNow' };

/** bridge (isolated) -> inject (MAIN) */
export const BRIDGE_SRC = 't11-bridge';
export type BridgeMessage =
  | { src: typeof BRIDGE_SRC; cmd: 'settings'; payload: StoredState }
  | { src: typeof BRIDGE_SRC; cmd: 'beep' }
  | { src: typeof BRIDGE_SRC; cmd: 'dump' }
  | { src: typeof BRIDGE_SRC; cmd: 'scanNow' };

/** inject (MAIN) -> bridge (isolated) */
export const PAGE_SRC = 't11-page';
export type PageMessage = { src: typeof PAGE_SRC; cmd: 'scan'; payload: ScanResult };

export async function loadState(): Promise<StoredState> {
  const s = await chrome.storage.local.get(['running', 'settings', 'lastScan']);
  return {
    running: Boolean(s.running),
    settings: { ...DEFAULT_SETTINGS, ...(s.settings as Partial<Settings> | undefined) },
    lastScan: s.lastScan as ScanResult | undefined,
  };
}
