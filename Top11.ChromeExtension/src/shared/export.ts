// Експорт складу для сайту Top11 (вставляється на сторінці команди → «Імпорт з гри»).
import type { SquadPlayer } from './messages';
import { GK_GROUPS, OUTFIELD_GROUPS, SKILL_BASE, SKILL_STEP } from './skills';

export const EXPORT_FORMAT = 'top11-squad';
export const EXPORT_VERSION = 1;

export interface ExportSkill {
  /** enum SkillType на сайті */
  skillType: string;
  /** Без бонусу рангу, може бути від'ємним (сайт додає tierUp сам, якщо isTierUp) */
  value: number;
  /** Сире значення з гри (поле 14.15.N) */
  raw: number;
  isMain: boolean;
  isTierUp: boolean;
}

export interface ExportPlayer {
  gameId: number;
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  number: number;
  /** Як на сайті: FIELD_PLAYER | GOOLKEEPER */
  position: 'FIELD_PLAYER' | 'GOOLKEEPER';
  positions: string[];
  rank: number;
  /** Бонус рангу (на сайті поле tierUp) */
  tierUp: number;
  skills: ExportSkill[];
}

export interface ExportPayload {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  players: ExportPlayer[];
}

export function exportPlayer(p: SquadPlayer): ExportPlayer {
  const isGk = p.positions.includes('GK');
  const skills: ExportSkill[] = (isGk ? GK_GROUPS : OUTFIELD_GROUPS).flatMap(g => g.idx.map((field, i) => {
    const raw = p.skills[field - 1] ?? 0;
    const key = raw > SKILL_BASE;
    return { skillType: g.types[i]!, value: Math.floor((raw - SKILL_BASE) / SKILL_STEP), raw, isMain: key, isTierUp: key };
  }));
  return {
    gameId: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    firstName: p.firstName,
    lastName: p.lastName,
    age: p.age,
    number: p.number,
    position: isGk ? 'GOOLKEEPER' : 'FIELD_PLAYER',
    positions: p.positions,
    rank: p.rank ?? 0,
    tierUp: p.rankBonus ?? 0,
    skills,
  };
}

export const buildExport = (players: SquadPlayer[]): ExportPayload => ({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  exportedAt: new Date().toISOString(),
  players: players.map(exportPlayer),
});
