import { DEFAULT_PARAMS, type AlgoParams } from '../config';
import type { Candle, Zone } from '../types';
import { createZone } from '../zone';

// Faqat ish kunlari (dush–jum), 2024-01-01 dushanbadan boshlab
export function weekdayTimestamps(count: number, start = '2024-01-01'): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString());
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// [open, high, low, close] qatorlaridan shamlar
export function candles(rows: [number, number, number, number][], start?: string): Candle[] {
  const ts = weekdayTimestamps(rows.length, start);
  return rows.map(([open, high, low, close], i) => ({ timestamp: ts[i], open, high, low, close }));
}

// Yopilish narxlari yo'lidan shamlar: open = oldingi close, fitil ±wick
export function pathCandles(closes: number[], wick = 0.5): Candle[] {
  return candles(
    closes.map((close, i) => {
      const open = i === 0 ? close : closes[i - 1];
      return [open, Math.max(open, close) + wick, Math.min(open, close) - wick, close];
    }),
  );
}

// Takrorlanadigan tasodifiy yurish (seed bilan)
export function randomWalk(count: number, seed = 42): Candle[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const rows: [number, number, number, number][] = [];
  let price = 1000;
  for (let i = 0; i < count; i++) {
    const open = price;
    // Ba'zan kichik tanali, ba'zan katta impuls shamlar
    const scale = rand() < 0.15 ? 25 : rand() < 0.4 ? 2 : 10;
    const close = Math.max(100, open + (rand() - 0.5) * 2 * scale);
    rows.push([open, Math.max(open, close) + rand() * 5, Math.min(open, close) - rand() * 5, close]);
    price = close;
  }
  return candles(rows);
}

export function params(overrides: Partial<AlgoParams> = {}): AlgoParams {
  return { ...DEFAULT_PARAMS, ...overrides };
}

export function zone(init: Partial<Zone> & Pick<Zone, 'kind' | 'top' | 'bottom'>): Zone {
  return createZone({ formedIndex: 0, confirmedIndex: 0, atrAtFormation: 1, ...init });
}
