// Склад власної команди. Приходить у відповіді на стартовий запит (cmd 0x0002), поле 106.
import { field, fields, isMsg, msg, num, str, type PbField } from './proto';
import { POSITIONS } from './auction';
import type { SquadPlayer } from '../shared/messages';

export const CMD_INIT = 0x0002;
/** Превʼю матчу: склади обох команд, у кожного гравця є К (25.1) */
export const CMD_MATCH_PREVIEW = 0x0052;

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
    const p = msg(rec.m, 14);
    if (!p) continue;
    const rank = msg(rec.m, 40);
    const bonus = field(rank, 3);
    out.push({
      rank: num(rank, 1) ?? 0,
      rankBonus: typeof bonus === 'object' && 'fl' in bonus ? Math.round(bonus.fl * 4) : 0,
      id: num(p, 1) ?? 0,
      number: num(rec.m, 16) ?? 0,
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
    });
  }
  return out.length ? out : null;
}
