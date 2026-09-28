import { describe, expect, it } from 'vitest';
import { findSwings } from '../swings';
import { candles } from './helpers';

// Faqat high berilgan shamlar: low = high − 2
const byHighs = (highs: number[]) => candles(highs.map((h) => [h - 1, h, h - 2, h - 1]));

describe('findSwings (fraktal)', () => {
  it('cho\'qqini topadi va N sham keyin tasdiqlaydi', () => {
    const swings = findSwings(byHighs([1, 2, 5, 3, 2, 4, 1]), 2);
    expect(swings).toEqual([{ index: 2, confirmedIndex: 4, type: 'high', price: 5 }]);
  });

  it('teng cho\'qqilardan (double top) faqat birinchisini oladi', () => {
    const swings = findSwings(byHighs([1, 2, 5, 5, 2, 1, 0]), 2).filter((s) => s.type === 'high');
    expect(swings.map((s) => s.index)).toEqual([2]);
  });

  it('oxirgi N sham hali swing bo\'la olmaydi (o\'ng tomoni yopilmagan)', () => {
    expect(findSwings(byHighs([1, 2, 3, 4, 5, 9]), 2).filter((s) => s.type === 'high')).toEqual([]);
  });

  it('outside bar bir vaqtda ham high, ham low bo\'lishi mumkin', () => {
    const swings = findSwings(
      candles([
        [4.5, 5, 4, 4.5],
        [5, 10, 1, 6],
        [5, 6, 3, 4],
      ]),
      1,
    );
    expect(swings.map((s) => s.type).sort()).toEqual(['high', 'low']);
    expect(swings.every((s) => s.index === 1 && s.confirmedIndex === 2)).toBe(true);
  });

  it('swing low', () => {
    const lows = [10, 9, 6, 8, 9, 7, 10];
    const swings = findSwings(candles(lows.map((l) => [l + 1, l + 2, l, l + 1])), 2);
    expect(swings.filter((s) => s.type === 'low')).toEqual([{ index: 2, confirmedIndex: 4, type: 'low', price: 6 }]);
  });
});
