// Schema-less protobuf decoder.

export type PbValue =
  | number
  | string
  | { d: number }                 // wire 1 (fixed64 як double)
  | { fl: number; u: number }     // wire 5 (fixed32: float / uint)
  | { m: PbField[] }              // вкладене повідомлення
  | { hex: string; len: number }; // невідомі байти

export interface PbField { f: number; w: number; v: PbValue }

/** Заголовок кадру Top Eleven: [u32 BE довжина][u8 тип][u32 BE seq][u16 BE команда] */
export const HEADER_LEN = 11;

export const enum FrameType {
  Request = 0,
  Response = 1,
}

export interface DecodedFrame {
  type: number;
  seq: number;
  cmd: number;
  m: PbField[];
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

interface Cursor { i: number }

function readVarint(b: Uint8Array, p: Cursor): number {
  let r = 0, mul = 1, shift = 0, byte: number;
  do {
    if (p.i >= b.length || shift > 63) throw new RangeError('varint');
    byte = b[p.i++]!;
    r += (byte & 0x7f) * mul;
    mul *= 128;
    shift += 7;
  } while (byte & 0x80);
  return r;
}

function isPrintable(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) return false;
  }
  return true;
}

function toHex(b: Uint8Array, max = 64): string {
  let s = '';
  for (let i = 0; i < Math.min(b.length, max); i++) s += b[i]!.toString(16).padStart(2, '0');
  return b.length > max ? s + '…' : s;
}

export function decode(b: Uint8Array, depth = 0): PbField[] | null {
  const out: PbField[] = [];
  const p: Cursor = { i: 0 };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    while (p.i < b.length) {
      const key = readVarint(b, p);
      const f = Math.floor(key / 8), w = key & 7;
      if (f < 1 || f > 10000) return null;
      let v: PbValue;
      switch (w) {
        case 0:
          v = readVarint(b, p);
          break;
        case 1:
          if (p.i + 8 > b.length) return null;
          v = { d: dv.getFloat64(p.i, true) };
          p.i += 8;
          break;
        case 5:
          if (p.i + 4 > b.length) return null;
          v = { fl: dv.getFloat32(p.i, true), u: dv.getUint32(p.i, true) };
          p.i += 4;
          break;
        case 2: {
          const len = readVarint(b, p);
          if (p.i + len > b.length) return null;
          v = interpretBytes(b.subarray(p.i, p.i + len), depth);
          p.i += len;
          break;
        }
        default:
          return null;
      }
      out.push({ f, w, v });
    }
  } catch {
    return null;
  }
  return out;
}

function interpretBytes(sub: Uint8Array, depth: number): PbValue {
  if (sub.length === 0) return '';
  try {
    const s = utf8.decode(sub);
    if (isPrintable(s)) return s;
  } catch { /* не utf-8 */ }
  if (depth < 30) {
    const m = decode(sub, depth + 1);
    if (m?.length) return { m };
  }
  return { hex: toHex(sub), len: sub.length };
}

export function decodeFrame(u8: Uint8Array): DecodedFrame | null {
  if (u8.length < HEADER_LEN) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const type = dv.getUint8(4);
  const seq = dv.getUint32(5);
  const cmd = dv.getUint16(9);
  const body = u8.subarray(HEADER_LEN);
  const m = body.length ? decode(body) : [];
  return m ? { type, seq, cmd, m } : null;
}

export function isMsg(v: PbValue): v is { m: PbField[] } {
  return typeof v === 'object' && 'm' in v;
}

/** Плоске представлення: ["1.3.2", value] — для пошуку. */
export function flatten(m: PbField[], prefix = '', acc: [string, PbValue][] = []): [string, PbValue][] {
  for (const { f, v } of m) {
    const k = prefix ? `${prefix}.${f}` : String(f);
    if (isMsg(v)) flatten(v.m, k, acc);
    else acc.push([k, v]);
  }
  return acc;
}

/** Перше поле з номером f */
export function field(m: PbField[] | undefined, f: number): PbValue | undefined {
  return m?.find(x => x.f === f)?.v;
}

/** Усі поля з номером f (repeated) */
export function fields(m: PbField[] | undefined, f: number): PbValue[] {
  return m?.filter(x => x.f === f).map(x => x.v) ?? [];
}

export function msg(m: PbField[] | undefined, f: number): PbField[] | undefined {
  const v = field(m, f);
  return v !== undefined && isMsg(v) ? v.m : undefined;
}

export function num(m: PbField[] | undefined, f: number): number | undefined {
  const v = field(m, f);
  return typeof v === 'number' ? v : undefined;
}

export function str(m: PbField[] | undefined, f: number): string | undefined {
  const v = field(m, f);
  return typeof v === 'string' ? v : undefined;
}
