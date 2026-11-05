// Кнопка «Top11» у верхньому меню гри (поруч із «Play» / «Buy Tokens») — відкриває сторінку розширення, як клік по T.
// Розмітку гри не знаємо напевно, тому клонуємо сусідню вкладку «Buy Tokens»: той самий вигляд і стилі.

const ID = 't11-menu-btn';
const NEIGHBOUR = /^\s*Buy Tokens\s*$/i;

/** Найзовнішній елемент, увесь текст якого — «Buy Tokens» (сама вкладка, а не span усередині) */
function findTab(): HTMLElement | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!NEIGHBOUR.test(n.textContent ?? '')) continue;
    let el = n.parentElement;
    while (el?.parentElement && el.parentElement !== document.body && NEIGHBOUR.test(el.parentElement.textContent ?? '')) el = el.parentElement;
    if (el) return el;
  }
  return null;
}

/** Той самий значок, що й іконка розширення та фавіконка сайту (кружечок з градієнтом і T) */
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="22" height="22">'
  + '<defs><linearGradient id="t11g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0dde9c"/><stop offset="1" stop-color="#3299ff"/></linearGradient></defs>'
  + '<circle cx="32" cy="32" r="31" fill="url(#t11g)"/>'
  + '<rect x="17" y="17" width="30" height="9" rx="2" fill="#10141c"/><rect x="27.5" y="17" width="9" height="31" rx="2" fill="#10141c"/></svg>';

function badge(): HTMLElement {
  const b = document.createElement('span');
  b.innerHTML = LOGO_SVG;
  b.style.cssText = 'display:inline-flex;width:22px;height:22px;margin-right:6px;vertical-align:middle;filter:drop-shadow(0 0 4px rgba(13,222,156,.6))';
  return b;
}

function build(tab: HTMLElement, onClick: () => void): HTMLElement {
  const btn = tab.cloneNode(true) as HTMLElement;
  btn.id = ID;
  btn.title = 'Відкрити сторінку Top11 (аукціон, моя команда)';
  // посилання / обробники гри з клону прибираємо
  for (const el of [btn, ...btn.querySelectorAll<HTMLElement>('*')]) {
    el.removeAttribute('href');
    el.removeAttribute('onclick');
    el.removeAttribute('target');
    el.removeAttribute('id');
    if (el.classList) for (const c of [...el.classList]) if (/active|selected|current/i.test(c)) el.classList.remove(c);
  }
  btn.id = ID;
  // текст
  const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (NEIGHBOUR.test(n.textContent ?? '')) { n.textContent = 'Top11'; break; }
  }
  // іконка: img / svg / i або порожній div з картинкою через CSS (як у Top Eleven: li > div > div + span) — на свою
  const icon = btn.querySelector('img, svg, i')
    ?? [...btn.querySelectorAll<HTMLElement>('div, span')].find(el => !el.children.length && !el.textContent?.trim());
  if (icon) icon.replaceWith(badge());
  else btn.insertBefore(badge(), btn.firstChild);
  btn.style.cursor = 'pointer';
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  }, true);
  return btn;
}

export function installMenuButton(onClick: () => void): void {
  let timer: number | undefined;
  const ensure = () => {
    if (!document.body || document.getElementById(ID)) return;
    const tab = findTab();
    if (tab) tab.after(build(tab, onClick));
  };
  const start = () => {
    ensure();
    // меню може перемальовуватись — повертаємо кнопку (з дебаунсом)
    new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(ensure, 300);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}
