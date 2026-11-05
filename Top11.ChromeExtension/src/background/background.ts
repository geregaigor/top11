// Клік по іконці: відкрити сторінку Top11 у новій вкладці поруч або перейти на вже відкриту.
const PAGE = chrome.runtime.getURL('viewer.html');
const GAME = 'https://www.topeleven.com/play';

chrome.action.onClicked.addListener(async (tab) => {
  const [ctx] = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  const existing = ctx && ctx.tabId >= 0 ? await chrome.tabs.get(ctx.tabId).catch(() => undefined) : undefined;
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }

  const game = tab.url?.startsWith(GAME) ? `?tab=${tab.id}` : '';
  await chrome.tabs.create({ url: PAGE + game, index: tab.index + 1, windowId: tab.windowId });
});

