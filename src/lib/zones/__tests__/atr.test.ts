import { describe, expect, it } from 'vitest';
import { computeAtr, trueRange } from '../atr';
import { candles } from './helpers';

describe('trueRange', () => {
  it('oldingi sham bo\'lmasa — high − low', () => {
    const [c] = candles([[10, 12, 9, 11]]);
    expect(trueRange(c)).toBe(3);
  });

  it('gap bo\'lsa oldingi close bilan farq olinadi', () => {
    const [prev, c] = candles([
      [10, 13, 10, 13],
      [20, 21, 19.5, 20],
    ]);
    expect(trueRange(c, prev)).toBe(8); // |21 − 13|
  });
});

describe('computeAtr (Wilder)', () => {
  const data = candles([
    [10, 11, 9, 10], // TR 2
    [10, 12, 10, 11], // TR 2
    [11, 11, 10, 10.5], // TR 1
    [10.5, 14, 10.5, 13], // TR 3.5
  ]);

  it('birinchi period−1 qiymat null', () => {
    const atr = computeAtr(data, 3);
    expect(atr[0]).toBeNull();
    expect(atr[1]).toBeNull();
  });

  it('birinchi ATR — oddiy o\'rtacha, keyingilari Wilder silliqlashi', () => {
    const atr = computeAtr(data, 3);
    expect(atr[2]).toBeCloseTo(5 / 3);
    expect(atr[3]).toBeCloseTo(((5 / 3) * 2 + 3.5) / 3);
  });

  it('shamlar periodan kam bo\'lsa hammasi null', () => {
    expect(computeAtr(data.slice(0, 2), 3)).toEqual([null, null]);
  });
});
