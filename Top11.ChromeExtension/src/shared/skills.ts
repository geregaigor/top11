// Навички гравця: сирі значення 14.15.1..15 -> значення, як у картці гри.
// Перевірено на Pepe (DC), Skakun (ST), Raphinha (MR), Trubin (GK): збігаються навички, суми груп і ОБЩ.

/** Сире значення, від якого починається навичка */
export const SKILL_BASE = 21500;
/** Сирих одиниць на 1 пункт навички */
export const SKILL_STEP = 25;
/** Сире значення, з яким гра малює навичку зірочкою (максимум) */
export const SKILL_MAX_RAW = 31500;

/**
 * Ранг гравця (поле запису 40.1). Бонус до ключових навичок = 40.3 * 4.
 * Назви й бонуси — FAQ Nordeus «Player tiers explained»: Rare +10, Elite +30, Stellar +50, Master +80, Epic +120, Legendary +160.
 */
export const RANKS: Record<number, string> = {
  1: 'Рідкісний',
  2: 'Елітний',
  3: 'Зірковий',
  4: 'Майстер',
  5: 'Епічний',
  6: 'Легендарний',
};
export const rankName = (r: number) => RANKS[r] ?? (r ? `Ранг ${r}` : '—');

export interface SkillGroup {
  title: string;
  /** Номери полів 14.15.N */
  idx: number[];
  names: string[];
  /** Назви навичок на сайті Top11 (enum SkillType) у тому ж порядку */
  types: string[];
}

export const OUTFIELD_GROUPS: SkillGroup[] = [
  { title: 'Захист', idx: [9, 5, 13, 11, 15], names: ['Відбір м’яча', 'Опіка', 'Вибір позиції', 'Удар головою', 'Хоробрість'],
    types: ['TACKLING', 'MARKING', 'POSITIONING', 'HEADING', 'BRAVERY'] },
  { title: 'Атака', idx: [8, 10, 14, 4, 12], names: ['Передача', 'Дриблінг', 'Навіс', 'Удари', 'Завершення'],
    types: ['PASSING', 'DRIBBLING', 'CROSSING', 'SHOOTING', 'FINISHING'] },
  { title: 'Психофізика', idx: [7, 3, 2, 6, 1], names: ['Фіз. форма', 'Сила', 'Агресивність', 'Швидкість', 'Креативність'],
    types: ['FITNESS', 'STRENGTH', 'AGGRESSION', 'SPEED', 'CREATIVITY'] },
];

/** У воротаря ті самі поля, але 10 з них — «Захист воріт» (дві колонки). */
export const GK_GROUPS: SkillGroup[] = [
  { title: 'Захист воріт', idx: [8, 10, 14, 4, 12], names: ['Рефлекси', 'Спритність', 'Чуття', 'Вихід з воріт', 'Комунікація'],
    types: ['REFLEXES', 'AGILITY', 'ANTICIPATION', 'RUSHING_OUT', 'COMMUNICATION'] },
  { title: 'Захист воріт', idx: [9, 5, 13, 11, 15], names: ['Кидок', 'Вибивання', 'Гра кулаками', 'Гра в повітрі', 'Концентрація'],
    types: ['THROWING', 'KICKING', 'PUNCHING', 'AERIAL_REACH', 'CONCENTRATION'] },
  OUTFIELD_GROUPS[2]!,
];

/**
 * Точне (не округлене) значення навички. Ключові навички (сире > SKILL_BASE) отримують бонус рангу,
 * неключові йдуть у мінус — гра показує їх як 1, але в суми груп і ОБЩ вони входять з мінусом.
 */
export function skillExact(raw: number, bonus: number): number {
  const v = (raw - SKILL_BASE) / SKILL_STEP;
  return raw > SKILL_BASE ? v + bonus : v;
}

/** Справжнє значення (може бути від'ємним) */
export const real = (exact: number) => Math.floor(exact);
/** Як показує гра: все, що ≤ 0, малює як 1 */
export const shown = (exact: number) => Math.max(1, Math.floor(exact));

export interface SkillCell {
  name: string;
  field: number;
  raw: number;
  /** Справжнє значення, може бути від'ємним */
  value: number;
  /** Як показує гра */
  game: number;
  /** Ключова навичка (отримує бонус рангу) */
  key: boolean;
  max: boolean;
}
export interface SkillColumn { title: string; value: number; game: number; cells: SkillCell[] }

export interface SkillSheet {
  columns: SkillColumn[];
  /** ОБЩ — середнє всіх 15 навичок (справжнє) */
  overall: number;
  /** ОБЩ як у грі */
  overallGame: number;
}

export function skillSheet(raw: number[], bonus: number, isGk: boolean): SkillSheet {
  const exact = (field: number) => skillExact(raw[field - 1] ?? 0, bonus);
  const groups = isGk ? GK_GROUPS : OUTFIELD_GROUPS;
  const columns = groups.map(g => {
    const cells = g.idx.map((field, i) => {
      const r = raw[field - 1] ?? 0;
      return { name: g.names[i]!, field, raw: r, value: real(exact(field)), game: shown(exact(field)), key: r > SKILL_BASE, max: r >= SKILL_MAX_RAW };
    });
    const avg = g.idx.reduce((a, f) => a + exact(f), 0) / g.idx.length;
    return { title: g.title, value: real(avg), game: shown(avg), cells };
  });
  // для воротаря заголовок «Захист воріт» — середнє обох колонок
  if (isGk) {
    const both = [...GK_GROUPS[0]!.idx, ...GK_GROUPS[1]!.idx].reduce((a, f) => a + exact(f), 0) / 10;
    columns[0]!.value = columns[1]!.value = real(both);
    columns[0]!.game = columns[1]!.game = shown(both);
  }
  const all = raw.length ? raw.reduce((a, _r, i) => a + exact(i + 1), 0) / raw.length : 0;
  return { columns, overall: real(all), overallGame: shown(all) };
}
