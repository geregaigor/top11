// Панель на сторінці гри: поточний список аукціону з К (талант), найкращі зверху.
// Таблицю гри (Unity canvas) змінити не можна, тому показуємо поруч — поверх рекламного стовпчика.
import type { AuctionPlayer } from '../shared/messages';

const ID = 't11-overlay';
const TALENT = 1.15;
let collapsed = false;
try { collapsed = localStorage.getItem('t11-overlay-collapsed') === '1'; } catch { /* ignore */ }

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${Math.round(n / 1e6)}M`);

function box(): HTMLDivElement {
  let el = document.getElementById(ID) as HTMLDivElement | null;
  if (el) return el;
  el = document.createElement('div');
  el.id = ID;
  el.style.cssText = 'position:fixed;right:8px;top:90px;width:270px;max-height:75vh;overflow:auto;z-index:2147483646;'
    + 'background:rgba(16,20,28,.94);color:#e6e9ef;border:1px solid #2fa84f;border-radius:8px;'
    + 'font:12px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5)';
  el.addEventListener('click', e => {
    if ((e.target as HTMLElement).dataset.t11 !== 'toggle') return;
    collapsed = !collapsed;
    try { localStorage.setItem('t11-overlay-collapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
    el!.querySelector<HTMLElement>('[data-t11=body]')!.style.display = collapsed ? 'none' : '';
    (e.target as HTMLElement).textContent = collapsed ? '+' : '–';
  });
  document.documentElement.appendChild(el);
  return el;
}

export function hideOverlay(): void {
  document.getElementById(ID)?.remove();
}

/** list — увесь список аукціону; isMatch — чи проходить фільтр */
export function renderOverlay(list: AuctionPlayer[], isMatch: (p: AuctionPlayer) => boolean): void {
  const el = box();
  const rows = [...list].sort((a, b) => a.age - b.age || (b.lotFactor || 0) - (a.lotFactor || 0));
  const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #262e3d;font-weight:700">
      <span>Top11 · аукціон <span style="opacity:.6;font-weight:400">${list.length} · ${time}</span></span>
      <span data-t11="toggle" style="cursor:pointer;padding:0 6px;font-size:14px" title="Згорнути">${collapsed ? '+' : '–'}</span>
    </div>
    <div data-t11="body" style="${collapsed ? 'display:none' : ''}">
      <table style="width:100%;border-collapse:collapse;color:#e6e9ef;font:inherit;background:transparent">
        <tr style="opacity:.6;text-align:left"><th style="padding:3px 6px">Гравець</th><th>Вік</th><th title="ОБЩ">О</th><th style="text-align:right;padding-right:6px" title="Талант: ≥ 1.15">К</th></tr>
        ${rows.map(p => {
          const k = p.lotFactor || 0;
          const tal = k >= TALENT;
          const m = isMatch(p);
          return `<tr style="border-top:1px solid #262e3d;${m ? 'background:#1f4d2c' : ''}" title="${esc(`${p.firstName} ${p.lastName} · ${p.positions.join(' ')} · ${fmt(p.price)}`)}">
            <td style="padding:3px 6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.lastName)} <span style="opacity:.55">${esc(p.positions.join(' '))}</span></td>
            <td>${p.age}</td><td>${p.quality}</td>
            <td style="text-align:right;padding-right:6px;${tal ? 'color:#ffcf5c;font-weight:700' : k < 0.95 ? 'opacity:.55' : ''}">${k ? k.toFixed(2) : '—'}</td>
          </tr>`;
        }).join('')}
      </table>
      <div style="padding:4px 8px;opacity:.55">За віком (молодші зверху). Жовтим — талант (К ≥ 1.15), зеленим рядком — під твій фільтр</div>
    </div>`;
}
