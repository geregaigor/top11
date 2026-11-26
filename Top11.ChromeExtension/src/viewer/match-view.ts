// Вкладка «Суперники»: К гравців суперників з превʼю матчів (0x52). Кожне відкрите в грі превʼю зберігається,
// суперника можна вибрати зі списку.
import type { PreviewPlayer, SavedOpponent, SavedOpponents } from '../shared/messages';

const TALENT = 1.15;
const SEL_KEY = 't11-opponent';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const posGroup = (p: string) => (p === 'GK' ? 'GK' : p.startsWith('D') && !p.startsWith('DM') ? 'D' : p.startsWith('A') || p === 'ST' ? 'A' : 'M');
const posTags = (p: PreviewPlayer) => p.positions.map(x => `<span class="pos ${posGroup(x)}">${x}</span>`).join('');
// ОБЩ не показуємо: формула навичок (SKILL_BASE/STEP) вірна лише для рівня своєї команди —
// у сильніших суперників сирі навички до 41000 і виходило 500+ замість ~150.
const when = (ts: number) => new Date(ts).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const talents = (o: SavedOpponent) => o.team.players.filter(p => (p.k ?? 0) >= TALENT).length;

let all: SavedOpponents = {};
let selected: string | null = null;
try { selected = localStorage.getItem(SEL_KEY); } catch { /* ignore */ }

function kCell(k?: number): string {
  if (!k) return '<td class="n">—</td>';
  const pct = Math.round((k - 1) * 100);
  const cls = k >= TALENT ? 'over' : k < 0.95 ? 't' : '';
  return `<td class="n ${cls}" title="швидкість тренування ${pct >= 0 ? '+' : ''}${pct}% від К = 1"><b>${k.toFixed(2)}</b></td>`;
}

function select(id: string): void {
  selected = id;
  try { localStorage.setItem(SEL_KEY, id); } catch { /* ignore */ }
  render();
}

function render(): void {
  const list = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts);
  const sel = $<HTMLSelectElement>('oppSelect');
  const meta = $('matchMeta');
  const body = $('matchBody');
  if (!list.length) {
    sel.hidden = true;
    $('oppDelete').hidden = true;
    meta.textContent = 'Суперників ще нема. Відкрий у грі «Превʼю» найближчого або поточного матчу — суперник збережеться тут.';
    body.innerHTML = '';
    return;
  }
  if (!selected || !all[selected]) selected = list[0]![0];
  sel.hidden = false;
  $('oppDelete').hidden = false;
  sel.innerHTML = list.map(([id, o]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(o.team.name)} · ${when(o.ts)} · талантів ${talents(o)}</option>`).join('');

  const o = all[selected]!;
  meta.textContent = `${o.vs ? `${o.vs} проти ${o.team.name}` : o.team.name} · превʼю ${when(o.ts)} · збережено суперників: ${list.length}`;
  const players = o.team.players; // як прийшло з сервера
  body.innerHTML = `<h3>${esc(o.team.name)} <small>${players.length} гравців · талантів (К ≥ ${TALENT}): ${talents(o)}</small></h3>
    <table><thead><tr><th class="n">№</th><th>Гравець</th><th>Амплуа</th><th class="n">Вік</th><th class="n" title="Талант: множник швидкості тренування. ≥ ${TALENT} — талант">К</th></tr></thead>
    <tbody>${players.map(p => `<tr><td class="n t">${p.number || ''}</td><td>${esc(p.firstName)} <b>${esc(p.lastName)}</b></td><td>${posTags(p)}</td><td class="n">${p.age}</td>${kCell(p.k)}</tr>`).join('')}</tbody></table>`;
}

export function initMatchView(): void {
  $<HTMLSelectElement>('oppSelect').onchange = e => select((e.target as HTMLSelectElement).value);
  $('oppDelete').onclick = async () => {
    if (!selected || !all[selected]) return;
    const { [selected]: _gone, ...rest } = all;
    selected = null;
    await chrome.storage.local.set({ opponents: rest });
  };
  void chrome.storage.local.get('opponents').then(r => { all = (r.opponents as SavedOpponents | undefined) ?? {}; render(); });
  chrome.storage.onChanged.addListener(changes => {
    if (!('opponents' in changes)) return;
    const next = (changes.opponents?.newValue as SavedOpponents | undefined) ?? {};
    // нове превʼю нової команди — одразу показуємо її; повторне превʼю вже збереженої (гра шле сама) вибір не збиває
    const fresh = Object.keys(next).filter(id => !all[id]).sort((a, b) => next[b]!.ts - next[a]!.ts)[0];
    all = next;
    if (fresh) select(fresh); else render();
  });
}
