/**
 * Мінімальний розв'язувач ЛП для невеликих задач:
 *   min c·x,  rows: a·x (>= | <=) b,  x >= 0.
 * Двофазний симплекс із правилом Бленда (без зациклення). null — розв'язку немає.
 */
export interface LpRow { a: number[]; op: '>=' | '<='; b: number }

const EPS = 1e-9;

export function solveLp(c: number[], rows: LpRow[]): { x: number[]; obj: number } | null {
  const n = c.length;
  // нормалізація: b >= 0
  const R = rows.map(r => r.b < 0
    ? { a: r.a.map(v => -v), op: (r.op === '>=' ? '<=' : '>=') as LpRow['op'], b: -r.b }
    : r);
  const m = R.length;
  const nArt = R.filter(r => r.op === '>=').length;
  const cols = n + m + nArt; // x | slack/surplus | artificial
  const T: number[][] = [];
  const basis: number[] = [];
  const isArt = (j: number) => j >= n + m;
  let art = n + m;
  R.forEach((r, i) => {
    const row = new Array(cols + 1).fill(0);
    r.a.forEach((v, j) => row[j] = v);
    row[cols] = r.b;
    if (r.op === '<=') { row[n + i] = 1; basis.push(n + i); }
    else { row[n + i] = -1; row[art] = 1; basis.push(art++); }
    T.push(row);
  });

  const pivot = (pr: number, pc: number) => {
    const p = T[pr][pc];
    for (let j = 0; j <= cols; j++) T[pr][j] /= p;
    for (let i = 0; i < T.length; i++) {
      if (i === pr) continue;
      const f = T[i][pc];
      if (Math.abs(f) < EPS) continue;
      for (let j = 0; j <= cols; j++) T[i][j] -= f * T[pr][j];
    }
    basis[pr] = pc;
  };

  const run = (cost: number[], allowArt: boolean): boolean => {
    for (let iter = 0; iter < 5000; iter++) {
      let enter = -1;
      for (let j = 0; j < cols; j++) {
        if (!allowArt && isArt(j)) continue;
        let r = cost[j];
        for (let i = 0; i < T.length; i++) r -= cost[basis[i]] * T[i][j];
        if (r < -EPS) { enter = j; break; }
      }
      if (enter < 0) return true;
      let leave = -1, best = Infinity;
      for (let i = 0; i < T.length; i++) {
        if (T[i][enter] > EPS) {
          const ratio = T[i][cols] / T[i][enter];
          if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[leave])) { best = ratio; leave = i; }
        }
      }
      if (leave < 0) return false; // необмежена
      pivot(leave, enter);
    }
    return false;
  };

  // фаза 1
  if (nArt) {
    const c1 = new Array(cols).fill(0).map((_, j) => isArt(j) ? 1 : 0);
    run(c1, true);
    const infeas = T.reduce((s, row, i) => s + (isArt(basis[i]) ? row[cols] : 0), 0);
    if (infeas > 1e-7) return null;
    // виводимо штучні змінні з базису
    for (let i = T.length - 1; i >= 0; i--) {
      if (!isArt(basis[i])) continue;
      const j = T[i].findIndex((v, k) => k < n + m && Math.abs(v) > EPS);
      if (j >= 0) pivot(i, j);
      else { T.splice(i, 1); basis.splice(i, 1); } // надлишкове обмеження
    }
  }
  // фаза 2
  const c2 = new Array(cols).fill(0); c.forEach((v, j) => c2[j] = v);
  if (!run(c2, false)) return null;
  const x = new Array(n).fill(0);
  basis.forEach((b, i) => { if (b < n) x[b] = T[i][cols]; });
  return { x, obj: c.reduce((s, v, j) => s + v * x[j], 0) };
}
