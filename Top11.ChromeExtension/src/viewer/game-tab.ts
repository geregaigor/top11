// Пошук вкладки з грою для сторінки розширення.
export const GAME = 'https://www.topeleven.com/play';

let cached: number | undefined;

export async function findGameTab(): Promise<number | undefined> {
  if (cached != null) {
    try {
      const t = await chrome.tabs.get(cached);
      if (t.url?.startsWith(GAME)) return cached;
    } catch { /* закрили */ }
    cached = undefined;
  }
  const p = Number(new URLSearchParams(location.search).get('tab'));
  if (p) {
    try {
      const t = await chrome.tabs.get(p);
      if (t.url?.startsWith(GAME)) return (cached = p);
    } catch { /* закрили */ }
  }
  const [t] = await chrome.tabs.query({ url: `${GAME}/*` });
  return (cached = t?.id);
}

export function forgetGameTab(): void {
  cached = undefined;
}
