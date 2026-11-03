import type { Skill, Training, TrainingType } from '../types';
import { solveLp, type LpRow } from './ilp';

export interface PumpingSkill {
  skillType: Skill;
  /** значення з бонусом рангу (як в UI) — для цілі */
  value: number;
  /** значення без бонусу рангу — для ліміту середнього по вправі */
  rawValue: number;
  /** світлий (головний) — для нього діє ціль */
  isMain: boolean;
  /** tier-up — качається на +tierUpGain за вправу, інакше +otherGain */
  isTierUp: boolean;
}

/**
 * - 'mainFocus'   — максимум у світлі: мінімальний приріст сірих (не головних) скілів
 * - 'simpleFirst' — спочатку простіші: щоразу корисна вправа з найменшим поточним середнім
 */
export type PumpingMode = 'mainFocus' | 'simpleFirst';

export interface PumpingOptions {
  target: number;
  mode?: PumpingMode;
  /** максимальне середнє по вправі (без рангу) */
  avgCap?: number;
  /** приріст tier-up скіла за 1 тренування */
  tierUpGain?: number;
  /** приріст скіла без tier-up за 1 тренування */
  otherGain?: number;
  /** ліміт часу на розрахунок, мс (після нього — найкраще знайдене) */
  timeBudgetMs?: number;
}

export interface PumpingPlanItem {
  trainingType: TrainingType;
  count: number;
  /** середнє по вправі (без рангу) на момент, коли до неї доходимо, і після її тренувань */
  avgBefore: number;
  avgAfter: number;
}

export interface PumpingResult {
  /** вправи в порядку виконання; кожну робимо повністю, потім наступну */
  plan: PumpingPlanItem[];
  total: number;
  /** сумарний приріст сірих (не головних) скілів */
  greyGain: number;
  /** значення скілів (з рангом) після виконання плану */
  result: Map<Skill, number>;
  /** світлі скіли, які не дотягують до цілі (ціль недосяжна через ліміт середнього) */
  notReached: Skill[];
}

/**
 * Підбір тренувань: усі світлі скіли >= target, середнє кожної вправи <= avgCap.
 *
 * Модель: тренування вправи дає кожному її скілу +tierUpGain (tier-up) або +otherGain.
 * Вправу можна робити, поки її середнє (сирі значення, без рангу) після тренування <= avgCap.
 *
 * На чому тримається алгоритм:
 *  1. Чергувати вправи не потрібно. Будь-який план можна виконати блоками — кожна вправа
 *     повністю, у порядку їхніх останніх тренувань, — і середні від цього тільки не більші.
 *     Отже план = порядок вправ + кількості.
 *  2. Для заданих кількостей придатний порядок знаходиться точно, з кінця (orderFromEnd):
 *     останньою може бути вправа, у якої в кінцевому стані середнє <= ліміту; знімаємо її
 *     і повторюємо. Якщо придатний порядок існує, так його буде знайдено.
 *  3. Для фіксованого порядку кількості рахуються точно (ЛП + гілки й межі, solveForOrder).
 *     Ліміт діє лише для вправ, які робимо: «вправу не робимо АБО її ліміт тримається».
 *
 * mainFocus:
 *  1. Порядок: спершу вправи, де найменша частка приросту йде в сірі (найцінніші — їм треба
 *     зберегти запас до ліміту), серед рівних — з найбільшим середнім (найменше запасу).
 *     Вправи з великою часткою сірих мають низьке середнє і запас із головою — їх у кінець.
 *  2. Точні кількості для цього порядку: мінімум приросту сірих, далі — мінімум тренувань.
 *  3. Уточнення: для знайденого плану — точний порядок з кінця і ще один розрахунок
 *     (стартуючи з уже знайденого плану, тож гірше не стане).
 *  Якщо ціль недосяжна, спершу максимально наближаємо світлі скіли (мінімальна сумарна
 *  нестача), а потім для досяжних значень мінімізуємо сірі.
 */
export function calculatePumping(skills: PumpingSkill[], trainings: Training[], opts: PumpingOptions): PumpingResult {
  const { target, mode = 'mainFocus', avgCap = 179, tierUpGain = 1, otherGain = 0.5, timeBudgetMs = 300 } = opts;
  const deadline = performance.now() + timeBudgetMs;
  const within = (ms: number) => Math.min(deadline, performance.now() + ms);

  const bySkill = new Map(skills.map(s => [s.skillType, s]));
  const gainOf = (s: Skill) => bySkill.get(s)!.isTierUp ? tierUpGain : otherGain;
  const isMain = (s: Skill) => bySkill.get(s)!.isMain;

  // вправи, що качають хоча б один світлий скіл і які можна зробити хоча б раз
  const drills = trainings
    .map(t => {
      const sk = t.skills.filter(s => bySkill.has(s));
      const rawSum = sk.reduce((a, s) => a + bySkill.get(s)!.rawValue, 0);
      const gainSum = sk.reduce((a, s) => a + gainOf(s), 0);
      const room = avgCap * sk.length - rawSum; // запас «суми скілів вправи» до ліміту
      return {
        type: t.trainingType,
        skills: sk,
        rawSum,
        gainSum,
        room,
        /** максимум тренувань, якщо робити цю вправу першою */
        cap: sk.length ? Math.max(0, Math.floor(room / gainSum + 1e-9)) : 0,
        /** приріст сірих скілів за 1 тренування */
        greyGain: sk.filter(s => !isMain(s)).reduce((a, s) => a + gainOf(s), 0),
        avg: sk.length ? rawSum / sk.length : 0,
      };
    })
    .filter(d => d.cap > 0 && d.skills.some(isMain));
  const n = drills.length;
  const all = drills.map((_, t) => t);
  /** shared[u][t] — на скільки 1 тренування вправи u піднімає суму скілів вправи t */
  const shared = drills.map(u => drills.map(t =>
    u.skills.filter(s => t.skills.includes(s)).reduce((a, s) => a + gainOf(s), 0)));

  const lacking = skills.filter(s => s.isMain && s.value < target);
  /** A[i][t] — приріст i-го світлого скіла, якому бракує до цілі, за 1 тренування вправи t */
  const A = lacking.map(s => drills.map(d => d.skills.includes(s.skillType) ? gainOf(s.skillType) : 0));
  /** ціна тренування: кожні +0.5 у сірий = 1000, саме тренування = 1 (мін. сірі, далі мін. тренувань) */
  const greyCost = drills.map(d => Math.round(d.greyGain * 2000) + 1);

  const zeros = () => new Array<number>(n).fill(0);
  const dot = (a: number[], x: number[]) => a.reduce((s, v, j) => s + v * x[j], 0);
  /** чи дотягують світлі скіли: b[i] — скільки бракувало i-му */
  const covers = (x: number[], b: number[]) => A.every((a, i) => dot(a, x) >= b[i] - 1e-6);

  /** чи вкладається план у ліміт, якщо робити вправи блоками в порядку order */
  const fitsOrder = (x: number[], order: number[]) => {
    for (let p = 0; p < order.length; p++) {
      const t = order[p];
      if (x[t] <= 0) continue;
      let load = 0;
      for (let q = 0; q <= p; q++) load += x[order[q]] * shared[order[q]][t];
      if (load > drills[t].room + 1e-6) return false;
    }
    return true;
  };

  /** точний порядок для готових кількостей — з кінця (п.2 вище); null — порядку не існує */
  const orderFromEnd = (x: number[]): number[] | null => {
    const left = new Set(all.filter(t => x[t] > 0));
    const order: number[] = [];
    while (left.size) {
      let last = -1, lastSlack = -Infinity;
      for (const t of left) {
        let load = 0;
        for (const u of left) load += x[u] * shared[u][t];
        const slack = drills[t].room - load;
        if (slack >= -1e-6 && slack > lastSlack) { last = t; lastSlack = slack; }
      }
      if (last < 0) return null;
      order.unshift(last);
      left.delete(last);
    }
    return order;
  };

  /**
   * Точні кількості для фіксованого порядку (ЛП + гілки й межі).
   * soft = false: усі світлі дотягують (b — скільки бракує), мінімум greyCost.
   * soft = true:  нестача дозволена, мінімум сумарної нестачі.
   * start — відомий план (береться, якщо вкладається в порядок). Після stopAt — найкраще знайдене.
   */
  const solveForOrder = (order: number[], b: number[], soft: boolean, start: number[] | null, stopAt: number) => {
    const L = b.length;
    const nv = n + (soft ? L : 0); // змінні: кількості вправ (+ нестача кожного скіла)
    const pos: number[] = [];
    order.forEach((t, i) => pos[t] = i);
    const unit = (j: number) => { const a = new Array<number>(nv).fill(0); a[j] = 1; return a; };
    const cost = soft ? [...zeros(), ...new Array<number>(L).fill(1)] : greyCost;
    const coverRows: LpRow[] = A.map((a, i) => ({ a: soft ? [...a, ...unit(n + i).slice(n)] : a, op: '>=', b: b[i] }));
    const capRows: LpRow[] = drills.map((d, t) => ({ a: unit(t), op: '<=', b: d.cap }));
    /** приріст суми скілів вправи t на кінець її блоку */
    const prefix = (t: number) => {
      const a = zeros();
      for (let q = 0; q <= pos[t]; q++) a[order[q]] = shared[order[q]][t];
      return a;
    };
    const limitRow = (t: number): LpRow => ({ a: soft ? [...prefix(t), ...new Array<number>(L).fill(0)] : prefix(t), op: '<=', b: drills[t].room });

    const evaluate = (x: number[]): number | null => {
      if (!fitsOrder(x, order)) return null;
      if (soft) return A.reduce((s, a, i) => s + Math.max(0, b[i] - dot(a, x)), 0);
      return covers(x, b) ? dot(greyCost, x) : null;
    };
    const best = { x: null as number[] | null, obj: Infinity };
    const offer = (x: number[]) => {
      const obj = evaluate(x);
      if (obj !== null && obj < best.obj - 1e-9) { best.x = x; best.obj = obj; }
    };
    if (start) offer(start);
    // greyCost цілі => оптимум цілий: вузол марний, якщо навіть округлена вгору межа не краща
    const hopeless = (bound: number) => soft ? bound >= best.obj - 1e-9 : Math.ceil(bound - 1e-6) >= best.obj;

    type Node = { bounds: LpRow[]; skip: number[]; limited: number[] };
    const stack: Node[] = [{ bounds: [], skip: [], limited: [] }];
    while (stack.length && performance.now() < stopAt) {
      const node = stack.pop()!;
      const lp = solveLp(cost, [
        ...coverRows, ...capRows, ...node.bounds,
        ...node.limited.map(limitRow),
        ...node.skip.map(t => ({ a: unit(t), op: '<=' as const, b: 0 })),
      ]);
      if (!lp || hopeless(lp.obj)) continue;
      const x = lp.x.slice(0, n);

      // швидкі цілі кандидати — округлення вгору і вниз
      offer(x.map(v => Math.ceil(v - 1e-6)));
      offer(x.map(v => Math.floor(v + 1e-6)));

      // вправу робимо, але її ліміт порушено: гілки «не робимо» / «ліміт тримається»
      let bad = -1, worst = 1e-6;
      for (let t = 0; t < n; t++) {
        if (x[t] <= 1e-6 || node.skip.includes(t) || node.limited.includes(t)) continue;
        const over = dot(prefix(t), x) - drills[t].room;
        if (over > worst) { worst = over; bad = t; }
      }
      if (bad >= 0) {
        stack.push({ ...node, skip: [...node.skip, bad] });
        stack.push({ ...node, limited: [...node.limited, bad] });
        continue;
      }

      // цілочисельність кількостей
      let fj = -1, frac = 1e-6;
      x.forEach((v, j) => { const f = Math.abs(v - Math.round(v)); if (f > frac) { frac = f; fj = j; } });
      if (fj < 0) { offer(x.map(v => Math.round(v))); continue; }
      stack.push({ ...node, bounds: [...node.bounds, { a: unit(fj), op: '<=', b: Math.floor(x[fj]) }] });
      stack.push({ ...node, bounds: [...node.bounds, { a: unit(fj), op: '>=', b: Math.ceil(x[fj]) }] });
    }
    return best.x;
  };

  /**
   * Покрокова симуляція: щоразу одне тренування корисної вправи з найменшим поточним середнім
   * (спершу серед вправ, де >= 50% приросту йде у світлі скіли, яким ще треба до цілі).
   */
  const simulate = (): number[] => {
    const raw = new Map(skills.map(s => [s.skillType, s.rawValue]));
    const val = new Map(skills.map(s => [s.skillType, s.value]));
    const x = zeros();
    const usefulShare = (t: number) => drills[t].skills
      .filter(s => isMain(s) && val.get(s)! < target)
      .reduce((a, s) => a + gainOf(s), 0) / drills[t].gainSum;
    for (let step = 0; step < 20_000; step++) {
      let best = -1, bestAvg = Infinity;
      for (const minShare of [0.5, 1e-9]) {
        for (let t = 0; t < n; t++) {
          const d = drills[t];
          if (usefulShare(t) < minShare) continue;
          const sum = d.skills.reduce((a, s) => a + raw.get(s)!, 0);
          if (sum + d.gainSum > avgCap * d.skills.length + 1e-9) continue; // після тренування вийде за ліміт
          const avg = sum / d.skills.length;
          if (avg < bestAvg - 1e-9) { best = t; bestAvg = avg; }
        }
        if (best >= 0) break;
      }
      if (best < 0) break;
      x[best]++;
      for (const s of drills[best].skills) {
        raw.set(s, raw.get(s)! + gainOf(s));
        val.set(s, val.get(s)! + gainOf(s));
      }
    }
    return x;
  };

  const finish = (x: number[], order: number[]): PumpingResult => {
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const extra = zeros(); // приріст суми скілів кожної вправи від уже зроблених блоків
    const plan: PumpingPlanItem[] = [];
    for (const t of order) {
      if (!x[t]) continue;
      const d = drills[t];
      const before = (d.rawSum + extra[t]) / d.skills.length;
      plan.push({ trainingType: d.type, count: x[t], avgBefore: round1(before), avgAfter: round1(before + x[t] * d.gainSum / d.skills.length) });
      for (let k = 0; k < n; k++) extra[k] += x[t] * shared[t][k];
    }
    const result = new Map<Skill, number>(skills.map(s => [s.skillType, s.value]));
    drills.forEach((d, t) => {
      if (x[t]) for (const s of d.skills) result.set(s, result.get(s)! + x[t] * gainOf(s));
    });
    return {
      plan,
      total: x.reduce((a, v) => a + v, 0),
      greyGain: drills.reduce((a, d, t) => a + x[t] * d.greyGain, 0),
      result,
      notReached: skills.filter(s => s.isMain && result.get(s.skillType)! < target - 1e-9).map(s => s.skillType),
    };
  };

  if (mode === 'simpleFirst') {
    const x = simulate();
    // симуляція не порушує ліміт, тож порядок блоками для неї існує завжди (п.1)
    return finish(x, orderFromEnd(x) ?? all);
  }
  if (!lacking.length || !n) return finish(zeros(), []);

  let b = lacking.map(s => target - s.value); // скільки бракує кожному світлому
  const greyShare = (t: number) => drills[t].greyGain / drills[t].gainSum;
  const natural = [...all].sort((p, q) => greyShare(p) - greyShare(q) || drills[q].avg - drills[p].avg);
  let order = natural;

  // 1-2. природний порядок і точні кількості для нього
  let x = solveForOrder(natural, b, false, null, within(timeBudgetMs / 2));
  if (!x) {
    const sim = simulate();
    if (covers(sim, b)) {
      x = sim;
      order = orderFromEnd(sim) ?? all;
    } else {
      // ціль недосяжна: максимально наближаємо світлі скіли, далі мінімізуємо сірі для досяжних значень
      const near = solveForOrder(natural, b, true, null, within(timeBudgetMs / 4)) ?? zeros();
      b = b.map((bi, i) => Math.min(bi, dot(A[i], near)));
      x = solveForOrder(natural, b, false, near, within(timeBudgetMs / 4)) ?? near;
    }
  }

  // 3. уточнення: точний порядок з кінця для знайденого плану і ще один розрахунок
  const used = orderFromEnd(x);
  if (used) {
    const refinedOrder = [...used, ...natural.filter(t => !used.includes(t))];
    const refined = solveForOrder(refinedOrder, b, false, x, deadline);
    if (refined && dot(greyCost, refined) < dot(greyCost, x)) { x = refined; order = refinedOrder; }
  }

  // прибираємо зайві тренування (менше тренувань — ліміт тим паче тримається)
  if (covers(x, b)) {
    for (const t of [...all].sort((p, q) => greyCost[q] - greyCost[p])) {
      while (x[t] > 0) {
        x[t]--;
        if (!covers(x, b)) { x[t]++; break; }
      }
    }
  }

  return finish(x, fitsOrder(x, order) ? order : orderFromEnd(x) ?? order);
}
