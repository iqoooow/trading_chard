import { describe, expect, it } from 'vitest';
import { computeAtr } from '../../zones/atr';
import { findSwings } from '../../zones/swings';
import { candles, params, randomWalk } from '../../zones/__tests__/helpers';
import { SHADOW_MAX_ATR, SHADOW_MIN_ATR, shadowOffset } from '../baseline';
import { measureOutcome } from '../outcome';
import { summarize } from '../stats';
import { algorithmProvider, collectEvents, createProviders, type BacktestEvent, type ProvidedZone, type ZoneProvider } from '../walkForward';

// Engine testidagi demand zona ssenariysi: zona [99, 101], 7/10/12-shamlarda test, 13-da buziladi
const p = params({ atrPeriod: 3, swingN: 50 });
const lifecycle = candles([
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 112, 100, 110],
  [110, 111, 109, 110],
  [110, 111, 105, 106],
  [106, 106, 100.5, 101],
  [101, 107, 101, 106.5],
  [106, 108, 104, 107],
  [107, 107, 100, 102],
  [103, 109, 102, 108],
  [108, 108, 100.5, 102],
  [102, 102, 90, 91],
]);

describe('measureOutcome', () => {
  it('qaytish → success, buzilish → fail, oyna tugamagan → pending', () => {
    expect(measureOutcome(lifecycle, 7, 'above', 101, 99, 5, p).outcome).toBe('success');
    expect(measureOutcome(lifecycle, 12, 'above', 101, 99, 6, p).outcome).toBe('fail');
    expect(measureOutcome(lifecycle.slice(0, 13), 12, 'above', 101, 99, 6, p).outcome).toBe('pending');
  });

  it('ushlab turdi, lekin 1 ATR qaytmadi → neutral', () => {
    const flat = candles([
      [105, 106, 104, 105],
      [105, 105, 100.5, 101],
      ...Array.from({ length: 6 }, (): [number, number, number, number] => [101, 102, 100.5, 101.5]),
    ]);
    expect(measureOutcome(flat, 1, 'above', 101, 99, 5, p).outcome).toBe('neutral');
  });
});

describe('shadowOffset (nazorat guruhi)', () => {
  const zone = { kind: 'sr' as const, formedIndex: 42, atrAtFormation: 10 };

  it('bir zona uchun barqaror, har xil k uchun har xil', () => {
    expect(shadowOffset(zone, 0, 1)).toBe(shadowOffset(zone, 0, 1));
    const offsets = [0, 1, 2, 3, 4].map((k) => shadowOffset(zone, k, 1));
    expect(new Set(offsets).size).toBe(5);
  });

  it('siljish ±1..4 ATR, ikkala yo\'nalishda ham', () => {
    const offsets = Array.from({ length: 200 }, (_, i) => shadowOffset({ ...zone, formedIndex: i }, 0, 1));
    for (const o of offsets) {
      expect(Math.abs(o)).toBeGreaterThanOrEqual(SHADOW_MIN_ATR * 10);
      expect(Math.abs(o)).toBeLessThanOrEqual(SHADOW_MAX_ATR * 10);
    }
    expect(offsets.some((o) => o > 0) && offsets.some((o) => o < 0)).toBe(true);
  });
});

describe('collectEvents (walk-forward)', () => {
  it('foydalanuvchi o\'sha kuni ko\'rgan zonaga kirishlarni topadi', () => {
    const events = collectEvents(lifecycle, p).filter((e) => !e.control && e.kind === 'demand');
    expect(events.map((e) => e.index)).toEqual([7, 10, 12]);
    expect(events.map((e) => e.outcome)).toEqual(['success', 'success', 'fail']);
    expect(events[0].score).toBeGreaterThan(events[2].score); // yangi zona > 2 marta test qilingan zona
    expect(events.every((e) => e.approach === 'above')).toBe(true);
  });

  it('hodisalar kelajak ma\'lumotiga bog\'liq emas: kesilgan ma\'lumotda ham xuddi shu kirishlar', () => {
    const data = randomWalk(260);
    const key = (e: BacktestEvent) => [e.index, e.control, e.kind, e.score, e.approach, e.widthAtr];
    const full = collectEvents(data, params(), { from: 100 });
    const cut = collectEvents(data.slice(0, 200), params(), { from: 100 });
    expect(cut.map(key)).toEqual(full.filter((e) => e.index < 200).map(key));
    expect(full.length).toBeGreaterThan(cut.length);
  });
});

// Metodikani kalibrlash: backtest haqiqiy ta'sirni ko'ra olishi va yo'q ta'sirni "ko'rmasligi" kerak
describe('kalibrlash', () => {
  it('oracle: kelajakdagi swinglarni "biladigan" zonalar kuchli edge ko\'rsatadi', () => {
    const data = randomWalk(1500, 7);
    const atr = computeAtr(data, 14);
    const byDay = new Map<number, ProvidedZone[]>();
    for (const s of findSwings(data, 5)) {
      const a = atr[s.index - 1];
      if (a === null || s.index < 2) continue;
      const prev = data[s.index - 1];
      // Swing shamining ekstremumida — oldingi sham tegmaydigan qilib
      const zone: ProvidedZone =
        s.type === 'low'
          ? { kind: 'demand', bottom: s.price - 0.3 * a, top: s.price + 0.1 * (prev.low - s.price), formedIndex: s.index, atrAtFormation: a, score: 100, touches: 1 }
          : { kind: 'supply', top: s.price + 0.3 * a, bottom: s.price - 0.1 * (s.price - prev.high), formedIndex: s.index, atrAtFormation: a, score: 100, touches: 1 };
      for (let t = Math.max(1, s.index - 30); t <= s.index; t++) byDay.set(t, [...(byDay.get(t) ?? []), zone]);
    }
    const oracle: ZoneProvider = (t) => ({ atr: atr[t - 1] ?? null, zones: byDay.get(t) ?? [] });

    const s = summarize(collectEvents(data, params(), { from: 20, provider: oracle }));
    expect(s.real.events).toBeGreaterThan(100);
    expect(s.control.events).toBeGreaterThan(100);
    expect(s.edge).toBeGreaterThan(0.15);
    expect(s.z).toBeGreaterThan(4);
  });

  it('null: xotirasiz tasodifiy bozorda (random walk) algoritm edge ko\'rsatmaydi', () => {
    const data = randomWalk(900, 3);
    const s = summarize(collectEvents(data, params(), { from: 250 }));
    expect(s.real.events).toBeGreaterThan(30);
    expect(Math.abs(s.z)).toBeLessThan(2.5);
  });
});

describe('createProviders', () => {
  const data = randomWalk(300);
  const { daily, weekly } = createProviders(data, params());

  it('kunlik provayder oddiy algorithmProvider bilan bir xil, keshdan qayta o\'qish ham bir xil', () => {
    const plain = algorithmProvider(data, params());
    for (const t of [120, 200, 299]) {
      expect(daily(t)).toEqual(plain(t));
      expect(daily(t)).toEqual(daily(t));
    }
  });

  it('haftalik zonalar kunlik ATR bilan qaytadi va touch soni bor', () => {
    const w = weekly(299);
    expect(w.atr).toBe(daily(299).atr);
    expect(w.zones.length).toBeGreaterThan(0);
    expect(w.zones.every((z) => Number.isInteger(z.touches))).toBe(true);
  });
});

describe('summarize', () => {
  const ev = (outcome: BacktestEvent['outcome'], control = false): BacktestEvent => ({
    index: 0,
    control,
    kind: 'sr',
    score: 0,
    touches: 1,
    approach: 'above',
    widthAtr: 1,
    outcome,
    reactionAtr: outcome === 'success' ? 1.5 : 0.5,
  });

  it('haqiqiy va nazorat ulushlari, edge, pending hisobga olinmaydi', () => {
    const s = summarize([
      ev('success'),
      ev('success'),
      ev('fail'),
      ev('neutral'),
      ev('pending'),
      ev('success', true),
      ev('fail', true),
      ev('fail', true),
      ev('fail', true),
    ]);
    expect(s.real).toMatchObject({ events: 4, successRate: 0.5, failRate: 0.25, neutralRate: 0.25 });
    expect(s.control).toMatchObject({ events: 4, successRate: 0.25, failRate: 0.75 });
    expect(s.edge).toBeCloseTo(0.25);
    expect(s.z).toBeGreaterThan(0);
    expect(s.failEdge).toBeCloseTo(0.25 - 0.75);
    expect(s.failZ).toBeLessThan(0);
  });

  it('bir xil natijada edge 0', () => {
    expect(summarize([ev('success'), ev('fail'), ev('success', true), ev('fail', true)]).edge).toBe(0);
  });
});
