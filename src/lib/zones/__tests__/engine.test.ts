import { describe, expect, it } from 'vitest';
import { computeAtr } from '../atr';
import { analyze, simulateZones } from '../engine';
import { findSwings } from '../swings';
import type { Candle, Zone } from '../types';
import { candles, params, pathCandles, randomWalk } from './helpers';

describe('demand zona hayot sikli (test → stale → invalid)', () => {
  // ATR period 3; swinglar o'chirilgan (swingN juda katta) — faqat S/D tekshiriladi
  const p = params({ atrPeriod: 3, swingN: 50 });
  const data = candles([
    [100, 101, 99, 100], // 0  baza
    [100, 101, 99, 100], // 1  baza
    [100, 101, 99, 100], // 2  baza
    [100, 101, 99, 100], // 3  baza
    [100, 112, 100, 110], // 4  impuls ↑ → demand [99, 101]
    [110, 111, 109, 110], // 5
    [110, 111, 105, 106], // 6
    [106, 106, 100.5, 101], // 7  1-test (yuqoridan)
    [101, 107, 101, 106.5], // 8
    [106, 108, 104, 107], // 9
    [107, 107, 100, 102], // 10 2-test
    [103, 109, 102, 108], // 11
    [108, 108, 100.5, 102], // 12 3-test → stale
    [102, 102, 90, 91], // 13 zona ostida aniq yopilish → invalid
  ]);

  const demandOf = (zones: Zone[]) => zones.find((z) => z.kind === 'demand')!;

  it('to\'liq ma\'lumotda: 3 test, keyin 13-shamda bekor', () => {
    const zone = demandOf(analyze(data, p, { includeWeekly: false }).zones);
    expect(zone).toMatchObject({ top: 101, bottom: 99, formedIndex: 1, confirmedIndex: 4 });
    expect(zone.tests.map((t) => t.index)).toEqual([7, 10, 12]);
    expect(zone.tests.every((t) => t.approach === 'above')).toBe(true);
    expect(zone.status).toBe('invalid');
    expect(zone.invalidatedIndex).toBe(13);
    expect(zone.scores.total).toBe(0);
  });

  it('reaksiyalar: qaytish (bounce), buzilishdan oldin qaytish, buzilish (break)', () => {
    const [t1, t2, t3] = demandOf(analyze(data, p, { includeWeekly: false }).zones).tests;
    expect(t1.reactionType).toBe('bounce');
    expect(t1.reactionAtr).toBeGreaterThan(1);
    expect(t2.reactionType).toBe('bounce'); // 1 ATR dan ko'p qaytgan, keyin buzilgan
    expect(t3.reactionType).toBe('break');
    expect(t3.reactionAtr).toBeLessThan(1);
  });

  it('12-shamgacha: zona eskirgan (stale), oxirgi test reaksiyasi hali noma\'lum', () => {
    const zone = demandOf(analyze(data.slice(0, 13), p, { includeWeekly: false }).zones);
    expect(zone.status).toBe('stale');
    expect(zone.invalidatedIndex).toBeNull();
    expect(zone.tests.at(-1)).toMatchObject({ index: 12, reactionType: 'pending', reactionAtr: null });
    expect(zone.scores.sd).toBe(25); // 3 test → freshness 25
  });
});

describe('S/R zonalar', () => {
  const p = params({ atrPeriod: 3, swingN: 2 });

  it('yaqin swinglar bitta zonaga birlashadi', () => {
    const data = pathCandles([
      100, 102, 104, 106, 108, 110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110.3, 108, 106, 104, 102, 100,
      102, 104,
    ]);
    const zones = analyze(data, p, { includeWeekly: false }).zones;
    expect(zones.map((z) => z.kind)).toEqual(['sr', 'sr']);

    const [high, low] = zones;
    expect(high.swingPrices).toEqual([110.5, 110.8]);
    expect(high.top).toBeGreaterThan(110.8);
    expect(high.bottom).toBeLessThan(110.5);
    expect(low.swingPrices).toEqual([99.5, 99.5]);
    expect(zones.every((z) => z.status === 'active')).toBe(true);
    expect(high.scores.sr).toBeGreaterThan(50); // 2 touch → 75 × recency × age
  });

  it('narx zonani aniq yopilish bilan kesib o\'tsa zona bekor, yangi swing yangi zona ochadi', () => {
    const data = pathCandles([
      100, 102, 104, 106, 108, 110, 108, 106, 104, 102, 100, 102, 104, 106, 108, 110.5, 113, 111, 109, 107, 105,
    ]);
    const zones = analyze(data, p, { includeWeekly: false }).zones;
    const first = zones.find((z) => z.swingPrices[0] === 110.5)!;
    expect(first.status).toBe('invalid');
    expect(first.invalidatedIndex).toBe(16);

    const second = zones.find((z) => z.swingPrices[0] === 113.5)!;
    expect(second.status).toBe('active');
    expect(second.swingPrices).toEqual([113.5]);
  });
});

describe('look-ahead yo\'qligi', () => {
  const data = randomWalk(400);
  const p = params();

  const simulate = (c: Candle[]) => simulateZones(c, computeAtr(c, p.atrPeriod), findSwings(c, p.swingN), p);
  const full = simulate(data);

  it('tasodifiy ma\'lumotda ham S/R, ham S/D zonalar topiladi (test bo\'sh emas)', () => {
    expect(full.some((z) => z.kind === 'sr')).toBe(true);
    expect(full.some((z) => z.kind === 'demand' || z.kind === 'supply')).toBe(true);
    expect(full.some((z) => z.status === 'invalid')).toBe(true);
  });

  // t-shamgacha kesilgan ma'lumotdagi holat to'liq ma'lumotdagi "t-sham holati" bilan bir xil
  // bo'lishi kerak. Har bir t tekshiriladi.
  it('har bir t uchun: prefiks natijasi to\'liq natijaning t-holatiga teng', () => {
    const testState = (x: Zone['tests'][number]) => [x.index, x.approach, x.zoneTop, x.zoneBottom];

    for (let t = p.atrPeriod; t < data.length; t++) {
      const prefix = simulate(data.slice(0, t + 1));
      const expected = full.filter((z) => z.confirmedIndex <= t);

      expect(prefix.map((z) => [z.kind, z.formedIndex, z.confirmedIndex]), `t=${t}`).toEqual(
        expected.map((z) => [z.kind, z.formedIndex, z.confirmedIndex]),
      );

      prefix.forEach((z, i) => {
        const f = expected[i];
        // S/R zona keyinroq yangi swinglar bilan kengayishi mumkin — prefiksdagi swinglar uning boshlanishi
        expect(f.swingPrices.slice(0, z.swingPrices.length), `t=${t}`).toEqual(z.swingPrices);
        if (z.kind !== 'sr') expect([z.top, z.bottom], `t=${t}`).toEqual([f.top, f.bottom]);
        // Test paytidagi zona chegaralari ham bir xil — zona kelajakdagi swing bilan erta kengaymagan
        expect(z.tests.map(testState), `t=${t}`).toEqual(f.tests.filter((x) => x.index <= t).map(testState));
        const invalidByT = f.invalidatedIndex !== null && f.invalidatedIndex <= t;
        expect(z.status === 'invalid', `t=${t}`).toBe(invalidByT);
      });
    }
  });

  it('natija deterministik', () => {
    expect(analyze(data)).toEqual(analyze(data));
  });

  it('bo\'sh ma\'lumotda xato bermaydi', () => {
    expect(analyze([]).zones).toEqual([]);
  });
});
