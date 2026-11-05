import { auctionOvr } from '../shared/value';
// Розбір відповіді на запит списку аукціону (команда 0x3E80).
import { field, fields, flatten, isMsg, msg, num, str, type PbField, type PbValue } from './proto';

const dbl = (v: PbValue | undefined) => (typeof v === 'object' && 'd' in v ? v.d : 0);

/** Плоскі сирі поля лота без зовнішності (18.*) */
function rawFields(lot: PbField[]): [string, string | number][] {
  return flatten(lot)
    .filter(([k]) => !k.startsWith('18.') && k !== '18')
    .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]);
}
import type { AuctionPlayer, Settings } from '../shared/messages';

export const CMD_AUCTION_LIST = 0x3e80;

/** Поле 40 (repeated): індекс амплуа */
export const POSITIONS = ['GK', 'DL', 'DC', 'DR', 'DML', 'DMC', 'DMR', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'] as const;

/** Значення поля 54, коли спецуміння нема */
export const NO_SPECIAL = 16;

/*
  Відповідь: repeated 1 = лот
    лот.25 = { 1: double } — невідомий коефіцієнт ~0.8–1.13
    лот.14 = гравець
      1  id
      2  ім'я
      3  прізвище
      5  вік
      15 навички: вкладене повідомлення з полями 1..15 (varint)
      26 ціна
      27 зарплата (у грі «З/П», ~75% від ціни)
      54 спецуміння (16 = нема)
      55 ігровий стиль: { 1: id, 2: 1 якщо є }
      4  країна (id)
      40 амплуа (repeated, індекс у POSITIONS)
*/
export function parseAuctionList(m: PbField[]): AuctionPlayer[] {
  const out: AuctionPlayer[] = [];
  for (const lot of fields(m, 1)) {
    if (!isMsg(lot)) continue;
    const p = msg(lot.m, 14);
    if (!p) continue;
    const skills = (msg(p, 15) ?? []).map(x => x.v).filter((v): v is number => typeof v === 'number');
    const skillAvg = skills.length ? skills.reduce((a, b) => a + b, 0) / skills.length : 0;
    const special = num(p, 54) ?? NO_SPECIAL;
    out.push({
      id: num(p, 1) ?? 0,
      firstName: str(p, 2) ?? '',
      lastName: str(p, 3) ?? '',
      age: num(p, 5) ?? 0,
      skillAvg,
      quality: auctionOvr(skillAvg),
      price: num(p, 26) ?? 0,
      special,
      hasSpecial: special !== NO_SPECIAL,
      hasStyle: num(msg(p, 55), 2) === 1,
      price2: num(p, 27) ?? 0,
      lotFactor: dbl(field(msg(lot.m, 25), 1)),
      raw: rawFields(lot.m),
      positions: fields(p, 40).filter((v): v is number => typeof v === 'number').map(i => POSITIONS[i] ?? `#${i}`),
    });
  }
  return out;
}

export function matches(p: AuctionPlayer, s: Pick<Settings, 'minAge' | 'maxAge' | 'minQuality' | 'maxQuality' | 'noSpecial' | 'singlePosition' | 'minK'>): boolean {
  return p.age >= s.minAge && p.age <= s.maxAge
    && p.quality >= s.minQuality && p.quality <= s.maxQuality
    && (!s.noSpecial || !p.hasSpecial)
    && (!s.singlePosition || p.positions.length === 1)
    && (!s.minK || p.lotFactor >= s.minK);
}
