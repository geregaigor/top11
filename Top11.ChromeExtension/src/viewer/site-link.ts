// Кнопка «Сайт Top11» у шапці: перемикає на вже відкриту вкладку сайту або відкриває нову поруч.
import { DEFAULT_UPDATER, type UpdaterConfig } from '../shared/codepack';

async function siteBase(): Promise<string> {
  const { updater } = await chrome.storage.local.get('updater') as { updater?: Partial<UpdaterConfig> };
  return (updater?.base || DEFAULT_UPDATER.base).replace(/\/+$/, '');
}

async function openSite(): Promise<void> {
  const base = await siteBase();
  // url видно лише для сайтів з host_permissions — для решти просто відкриємо нову вкладку
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url === base || t.url?.startsWith(base + '/'));
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  const [me] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.create({ url: base + '/', index: me ? me.index + 1 : undefined });
}

export function initSiteLink(): void {
  const a = document.getElementById('siteLink') as HTMLAnchorElement | null;
  if (!a) return;
  void siteBase().then(b => { a.href = b + '/'; a.title = `Відкрити ${b.replace(/^https?:\/\//, '')} (якщо вже відкритий — перемкне на нього)`; });
  a.addEventListener('click', e => {
    e.preventDefault();
    openSite().catch(() => window.open(a.href, '_blank'));
  });
}
