import type { PbField } from '../content/proto';

export interface Settings {
  minAge: number;
  maxAge: number;
  minQuality: number;
  maxQuality: number;
  /** Тільки гравці без спецуміння */
  noSpecial: boolean;
  /** Тільки гравці з одним амплуа */
  singlePosition: boolean;
  /** Мінімальний К лота (поле 25.1) — схоже, це талант: вправ на +1 ≈ 11.1 / К. 0 = не фільтрувати */
  minK: number;
  /** Панель з К поверх сторінки гри (справа) */
  overlay: boolean;
  /** Не давати грі «засинати», коли вкладка прихована (сокет не рветься) */
  keepAlive: boolean;
  /** Сигнал, коли в списку аукціону зʼявляється новий гравець під фільтр */
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  minAge: 18,
  maxAge: 19,
  minQuality: 0,
  maxQuality: 30,
  noSpecial: true,
  singlePosition: true,
  minK: 0,
  overlay: true,
  keepAlive: true,
  sound: true,
};

export interface AuctionPlayer {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  /** ОБЩ як у грі: середнє всіх 15 навичок, (сире − 21500) / 25 */
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
  /** Зарплата (поле 14.27, у грі «З/П»), ~75% від ціни */
  price2: number;
  /** Коефіцієнт лота (поле лота 25.1, double ~0.8–1.13). Значення невідоме — збираємо для аналізу */
  lotFactor: number;
  /** Усі сирі поля лота ["шлях", значення] (без 18 — картинки), для аналізу. Не показуються. */
  raw: [string, string | number][];
}

/** Гравець власної команди */
export interface SquadPlayer {
  id: number;
  number: number;
  firstName: string;
  lastName: string;
  age: number;
  country: number;
  height: number;
  weight: number;
  /** Стан, % */
  condition: number;
  value: number;
  value2: number;
  positions: string[];
  /** Сирі навички (поле 15.1..15) */
  skills: number[];
  /** Ранг (поле запису 40.1): 3 = Зірковий, 4 = Майстер */
  rank: number;
  /** Бонус рангу до ключових навичок (40.3 * 4) */
  rankBonus: number;
}

/** К (талант) гравців своєї команди: id гравця -> { k, ts }. Джерело — превʼю матчу (0x52), поле запису 25.1 */
export type SquadK = Record<string, { k: number; ts: number }>;

export interface SquadSnapshot {
  ts: number;
  players: SquadPlayer[];
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
  settings: Settings;
  lastScan?: ScanResult;
}

/** сторінка розширення (вкладка «Аукціон») -> content (chrome.tabs.sendMessage) */
export type PopupCommand = { cmd: 'beep' } | { cmd: 'dump' } | { cmd: 'ping' };

/** bridge (isolated) -> inject (MAIN) */
export const BRIDGE_SRC = 't11-bridge';
export type BridgeMessage =
  | { src: typeof BRIDGE_SRC; cmd: 'settings'; payload: StoredState }
  | { src: typeof BRIDGE_SRC; cmd: 'beep' }
  | { src: typeof BRIDGE_SRC; cmd: 'dump' }
  | { src: typeof BRIDGE_SRC; cmd: 'frames'; reqId: number; since: number };

/** inject (MAIN) -> bridge (isolated) */
export const PAGE_SRC = 't11-page';
export type PageMessage =
  | { src: typeof PAGE_SRC; cmd: 'scan'; payload: ScanResult }
  | { src: typeof PAGE_SRC; cmd: 'squad'; payload: SquadSnapshot }
  | { src: typeof PAGE_SRC; cmd: 'squadK'; payload: SquadK }
  | { src: typeof PAGE_SRC; cmd: 'wsEvent'; payload: WsEvent }
  | { src: typeof PAGE_SRC; cmd: 'live'; payload: LiveStatus }
  | { src: typeof PAGE_SRC; cmd: 'openViewer' }
  | { src: typeof PAGE_SRC; cmd: 'frames'; reqId: number; payload: FramesReply };

/** Стан сторінки гри для індикатора звʼязку */
export interface LiveStatus {
  /** Є відкритий сокет гри */
  wsOpen: boolean;
  /** Час останнього кадру від сервера (0 = ще не було) */
  lastInTs: number;
  /** Вкладка справді прихована */
  hidden: boolean;
  keepAlive: boolean;
}

/** Подія сокета / видимості вкладки гри — для діагностики розривів сесії */
export interface WsEvent {
  ts: number;
  kind: 'open' | 'close' | 'error' | 'hidden' | 'visible';
  code?: number;
  reason?: string;
  /** Чи була вкладка гри видимою в момент події */
  visible: boolean;
  /** Скільки секунд вкладка вже була прихована (для close) */
  hiddenSec?: number;
}

// ---------- Переглядач трафіку ----------

/** Кадр сокета у вигляді, придатному для передачі (без Uint8Array). */
export interface FrameDTO {
  /** Наскрізний номер кадру з моменту завантаження сторінки */
  id: number;
  ts: number;
  dir: 'in' | 'out';
  len: number;
  /** Заголовок: 0 = запит, 1 = відповідь, інше — push/невідомо */
  type?: number;
  seq?: number;
  cmd?: number;
  m?: PbField[];
  /** Сирі байти, якщо кадр не розібрався */
  hex?: string;
}

/** viewer -> content (chrome.tabs.sendMessage), відповідь — FramesReply */
export type ViewerRequest = { cmd: 'frames'; since: number };

export interface FramesReply {
  /** performance.timeOrigin вкладки гри — змінюється після F5 */
  session: number;
  /** Найстаріший id, що ще лишився в буфері сторінки */
  firstId: number;
  /** З якого id питати наступного разу */
  nextId: number;
  /** Є ще кадри (відповідь обрізана по ліміту) */
  more: boolean;
  frames: FrameDTO[];
}

export async function loadState(): Promise<StoredState> {
  const s = await chrome.storage.local.get(['settings', 'lastScan']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s.settings as Partial<Settings> | undefined) },
    lastScan: s.lastScan as ScanResult | undefined,
  };
}
