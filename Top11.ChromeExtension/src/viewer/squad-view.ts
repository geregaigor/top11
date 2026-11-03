// Вкладка «Моя команда»: склад з chrome.storage (зберігає bridge при старті гри).
import type { SquadPlayer, SquadSnapshot } from '../shared/messages';
import { rankName, skillSheet, type SkillSheet } from '../shared/skills';
import { buildExport } from '../shared/export';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const money = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`);

const POS_ORDER = ['GK', 'DL', 'DC', 'DR', 'DML', 'DMC', 'DMR', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'];
const posGroup = (p: string) => (p === 'GK' ? 'GK' : p.startsWith('D') && !p.startsWith('DM') ? 'D' : p.startsWith('A') || p === 'ST' ? 'A' : 'M');
/** Для сортування: найнижче (найближче до воріт) амплуа */
const posRank = (p: SquadPlayer) => Math.min(...p.positions.map(x => POS_ORDER.indexOf(x)).filter(i => i >= 0), 99);
const condColor = (c: number) => (c >= 80 ? '#2fa84f' : c >= 60 ? '#b5c732' : c >= 40 ? '#e0a030' : '#d04040');
const posTags = (p: SquadPlayer) => p.positions.map(x => `<span class="pos ${posGroup(x)}">${x}</span>`).join('');

const sheets = new Map<number, SkillSheet>();
function sheet(p: SquadPlayer): SkillSheet {
  let s = sheets.get(p.id);
  if (!s) sheets.set(p.id, (s = skillSheet(p.skills, p.rankBonus ?? 0, p.positions.includes('GK'))));
  return s;
}

interface Col {
  title: string;
  num?: boolean;
  key: (p: SquadPlayer) => number | string;
  cell: (p: SquadPlayer) => string;
  hint?: string;
}

const COLS: Col[] = [
  { title: '№', num: true, key: p => p.number, cell: p => String(p.number || '') },
  { title: 'Амплуа', key: posRank, cell: posTags },
  { title: "Ім'я", key: p => p.lastName, cell: p => `${esc(p.firstName)} <b>${esc(p.lastName)}</b>` },
  { title: 'Вік', num: true, key: p => p.age, cell: p => String(p.age) },
  { title: 'ОБЩ', num: true, key: p => sheet(p).overall, cell: p => `<b>${sheet(p).overall}</b>`, hint: 'Середнє всіх 15 навичок, як у грі' },
  { title: 'Ранг', key: p => p.rank ?? 0, cell: p => (p.rank ? `${rankName(p.rank)} <span class="t">+${p.rankBonus}</span>` : '—') },
  { title: 'Стан', num: true, key: p => p.condition, cell: p => `<span class="cond"><i style="width:${p.condition}%;background:${condColor(p.condition)}"></i></span>${p.condition}%` },
  { title: 'Вартість', num: true, key: p => p.value, cell: p => money(p.value), hint: 'поле 14.26' },
  { title: 'З/П', num: true, key: p => p.value2, cell: p => money(p.value2), hint: 'Зарплата (поле 14.27)' },
  { title: 'Зріст', num: true, key: p => p.height, cell: p => String(p.height || '') },
  { title: 'Вага', num: true, key: p => p.weight, cell: p => String(p.weight || '') },
];

let snapshot: SquadSnapshot | undefined;
let sortCol = 1;
let asc = true;
const openIds = new Set<number>();

/** Вибрані для експорту (id гравців), пам'ятаємо між відкриттями сторінки */
const SEL_KEY = 'squadExportSel';
const selected = new Set<number>(loadSel());
function loadSel(): number[] {
  try { return JSON.parse(localStorage.getItem(SEL_KEY) ?? '[]') as number[]; } catch { return []; }
}
function saveSel(): void {
  try { localStorage.setItem(SEL_KEY, JSON.stringify([...selected])); } catch { /* ignore */ }
}
const currentIds = () => (snapshot?.players ?? []).map(p => p.id);

function renderExportInfo(): void {
  const ids = new Set(currentIds());
  const n = [...selected].filter(id => ids.has(id)).length;
  const btn = $('exportSquad') as HTMLButtonElement;
  btn.textContent = `Експорт для Top11 (${n})`;
  btn.disabled = n === 0;
}

function card(p: SquadPlayer): string {
  const s = sheet(p);
  const cols = s.columns.map(c => `<div class="skcol">
      <div class="skhead"><span>${esc(c.title)}</span><b class="${c.value < 0 ? 'neg' : ''}" title="у грі: ${c.game}">${c.value}</b></div>
      ${c.cells.map(x => `<div class="sk ${x.key ? 'key' : ''}" title="поле 14.15.${x.field} · сире ${x.raw} · у грі: ${x.game}">
        <span>${esc(x.name)}</span><b class="${x.value < 0 ? 'neg' : ''}">${x.max ? '<i class="max">*</i>' : ''}${x.value}</b></div>`).join('')}
    </div>`).join('');
  return `<div class="card">
    <div class="cardhead">
      <span class="num">${p.number || ''}</span>
      <span class="nm">${esc(p.firstName)} <b>${esc(p.lastName)}</b></span>
      ${posTags(p)}
      <span class="ovr" title="у грі: ${s.overallGame}">ОБЩ <b>${s.overall}</b></span>
      <span class="rank">${rankName(p.rank)}${p.rank ? ` · +${p.rankBonus} до ключових` : ''}</span>
      <span class="t">${p.age} р. · ${p.height} см · ${p.weight} кг · стан ${p.condition}% · id ${p.id}</span>
    </div>
    <div class="skills">${cols}</div>
  </div>`;
}

function render(): void {
  const players = [...(snapshot?.players ?? [])];
  $('squadMeta').textContent = snapshot
    ? `${players.length} гравців · оновлено ${new Date(snapshot.ts).toLocaleString('uk-UA')} · клік по гравцю — навички · дані приходять при завантаженні гри (F5 вкладки гри — оновити)`
    : 'Складу ще нема — онови вкладку гри (F5), він приходить при старті.';

  const col = COLS[sortCol]!;
  players.sort((a, b) => {
    const x = col.key(a), y = col.key(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (asc ? r : -r) || a.number - b.number;
  });

  const ids = currentIds();
  const allSel = ids.length > 0 && ids.every(id => selected.has(id));
  $('squadHead').innerHTML = `<th class="chk"><input type="checkbox" id="selAll" title="Вибрати всіх" ${allSel ? 'checked' : ''}></th>` + COLS.map((c, i) =>
    `<th data-i="${i}" class="${c.num ? 'n' : ''} ${i === sortCol ? `sorted ${asc ? 'asc' : ''}` : ''}" ${c.hint ? `title="${esc(c.hint)}"` : ''}>${c.title}</th>`).join('');
  $('squadBody').innerHTML = players.map(p => {
    const open = openIds.has(p.id);
    return `<tr data-pid="${p.id}" class="prow ${open ? 'sel' : ''}"><td class="chk"><input type="checkbox" class="pick" data-pid="${p.id}" ${selected.has(p.id) ? 'checked' : ''}></td>${COLS.map(c => `<td class="${c.num ? 'n' : ''}">${c.cell(p)}</td>`).join('')}</tr>`
      + (open ? `<tr class="pcard"><td colspan="${COLS.length + 1}">${card(p)}</td></tr>` : '');
  }).join('');
  renderExportInfo();
}

async function exportSelected(): Promise<void> {
  const players = (snapshot?.players ?? []).filter(p => selected.has(p.id));
  if (!players.length) return;
  const btn = $('exportSquad') as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildExport(players), null, 1));
    btn.textContent = `Скопійовано (${players.length}) — встав на сайті: команда → «Імпорт з гри»`;
  } catch {
    btn.textContent = 'Помилка копіювання';
  }
  window.setTimeout(renderExportInfo, 3000);
}

export function initSquadView(): void {
  $('squadHead').addEventListener('change', e => {
    if ((e.target as HTMLElement).id !== 'selAll') return;
    const on = (e.target as HTMLInputElement).checked;
    for (const id of currentIds()) if (on) selected.add(id); else selected.delete(id);
    saveSel();
    render();
  });
  $('squadBody').addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains('pick')) return;
    const id = Number(t.dataset.pid);
    if (t.checked) selected.add(id); else selected.delete(id);
    saveSel();
    render();
  });
  $('exportSquad').addEventListener('click', () => void exportSelected());
  $('squadHead').addEventListener('click', e => {
    const th = (e.target as HTMLElement).closest<HTMLElement>('th[data-i]');
    if (!th) return;
    const i = Number(th.dataset.i);
    if (i === sortCol) asc = !asc; else { sortCol = i; asc = true; }
    render();
  });
  $('squadBody').addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('td.chk')) return;
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr.prow');
    if (!tr) return;
    const id = Number(tr.dataset.pid);
    if (!openIds.delete(id)) openIds.add(id);
    render();
  });
  const apply = (s: SquadSnapshot | undefined) => {
    snapshot = s;
    sheets.clear();
    render();
  };
  chrome.storage.onChanged.addListener(ch => {
    if ('squad' in ch) apply(ch.squad?.newValue as SquadSnapshot | undefined);
  });
  void chrome.storage.local.get('squad').then(s => apply(s.squad as SquadSnapshot | undefined));
}
