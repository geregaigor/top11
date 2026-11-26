// Склад власної команди. Приходить у відповіді на стартовий запит (cmd 0x0002), поле 106.
import { field, fields, isMsg, msg, num, str, type PbField } from './proto';
import { POSITIONS } from './auction';
import type { PreviewPlayer, PreviewTeam, SquadPlayer } from '../shared/messages';

export const CMD_INIT = 0x0002;
/** Превʼю матчу: склади обох команд, у кожного гравця є К (25.1) */
export const CMD_MATCH_PREVIEW = 0x0052;
/** Старт матчу (і товариського): склади обох команд з К. Перевірено 26.11.2026 — превʼю товариського (0xdf) К не має, а тут є */
export const CMD_MATCH_START = 0x003c;

/**
 * Збирає К для гравців з переданого набору id (своя команда) з будь-якого повідомлення,
 * де запис гравця має вигляд { 14: гравець, 25: { 1: double } }.
 */
export function collectK(m: PbField[], ids: Set<number>, out: Record<string, number> = {}): Record<string, number> {
  for (const x of m) {
    if (!isMsg(x.v)) continue;
    const p = msg(x.v.m, 14);
    const lot = msg(x.v.m, 25);
    const id = p ? num(p, 1) : undefined;
    const k = lot ? field(lot, 1) : undefined;
    if (id !== undefined && ids.has(id) && typeof k === 'object' && 'd' in k) out[String(id)] = k.d;
    else collectK(x.v.m, ids, out);
  }
  return out;
}

/*
  106 = склад
    repeated 1 = запис гравця
      16  номер на футболці
      40  ранг: { 1: ранг (3 Зірковий, 4 Майстер), 3: float бонус/4 }
      14  гравець (та сама структура, що й на аукціоні)
        1  id
        2  ім'я
        3  прізвище
        4  країна (id)
        5  вік
        6  зріст, см
        7  вага, кг
        13 стан, %
        15 навички 1..15 (сирі; перерахунок — shared/skills.ts)
        26 вартість
        27 зарплата (у грі «З/П»)
        40 амплуа (repeated, індекс у POSITIONS)
*/
export function parseSquad(m: PbField[]): SquadPlayer[] | null {
  const squad = msg(m, 106);
  if (!squad) return null;
  const out: SquadPlayer[] = [];
  for (const rec of fields(squad, 1)) {
    if (!isMsg(rec)) continue;
    const pl = parseRecord(rec.m);
    if (pl) out.push(pl);
  }
  return out.length ? out : null;
}

/** Запис гравця { 14: гравець, 16: номер, 40: ранг, 25: { 1: К } } — однаковий у складі і в превʼю матчу */
function parseRecord(m: PbField[]): PreviewPlayer | null {
  const p = msg(m, 14);
  if (!p) return null;
  const rank = msg(m, 40);
  const bonus = field(rank, 3);
  const k = field(msg(m, 25), 1);
  return {
    rank: num(rank, 1) ?? 0,
    rankBonus: typeof bonus === 'object' && 'fl' in bonus ? Math.round(bonus.fl * 4) : 0,
    id: num(p, 1) ?? 0,
    number: num(m, 16) ?? 0,
    firstName: str(p, 2) ?? '',
    lastName: str(p, 3) ?? '',
    age: num(p, 5) ?? 0,
    country: num(p, 4) ?? 0,
    height: num(p, 6) ?? 0,
    weight: num(p, 7) ?? 0,
    condition: num(p, 13) ?? 0,
    value: num(p, 26) ?? 0,
    value2: num(p, 27) ?? 0,
    positions: fields(p, 40).filter((v): v is number => typeof v === 'number').map(i => POSITIONS[i] ?? `#${i}`),
    skills: (msg(p, 15) ?? []).map(x => x.v).filter((v): v is number => typeof v === 'number'),
    k: typeof k === 'object' && 'd' in k && k.d > 0 ? k.d : undefined,
  };
}

/**
 * Превʼю матчу 0x52: поля 1 і 2 — команди { 1: id, 2: назва, 38: repeated запис гравця }.
 * Перевірено 26.11.2026: К (25.1) є в гравців обох команд. У профілі чужої команди (0x29) К немає.
 */
export function parseMatchPreview(m: PbField[]): PreviewTeam[] {
  const teams: PreviewTeam[] = [];
  for (const f of [1, 2]) {
    const t = msg(m, f);
    if (!t) continue;
    const players = fields(t, 38).flatMap(r => (isMsg(r) ? [parseRecord(r.m)] : [])).filter((x): x is PreviewPlayer => !!x);
    if (players.length) teams.push({ id: num(t, 1) ?? 0, name: str(t, 2) ?? '?', players });
  }
  return teams;
}

/** Старт матчу 0x3c: 3/4 — команди { 1: id, 2: назва }, 7/8 — записи гравців відповідних команд */
export function parseMatchStart(m: PbField[]): PreviewTeam[] {
  const teams: PreviewTeam[] = [];
  for (const [tf, pf] of [[3, 7], [4, 8]] as const) {
    const t = msg(m, tf);
    const players = fields(m, pf).flatMap(r => (isMsg(r) ? [parseRecord(r.m)] : [])).filter((x): x is PreviewPlayer => !!x);
    if (t && players.length) teams.push({ id: num(t, 1) ?? 0, name: str(t, 2) ?? '?', players });
  }
  return teams;
}
