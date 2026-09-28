import { describe, expect, it } from 'vitest';
import { aggregateWeekly, weekKey } from '../weekly';
import { candles } from './helpers';

describe('weekKey', () => {
  it('haftaning dushanba sanasini qaytaradi', () => {
    expect(weekKey('2024-01-05T00:00:00Z')).toBe('2024-01-01'); // juma
    expect(weekKey('2024-01-01T00:00:00Z')).toBe('2024-01-01'); // dushanba
    expect(weekKey('2024-01-07T00:00:00Z')).toBe('2024-01-01'); // yakshanba
  });
});

describe('aggregateWeekly', () => {
  // 2 to'liq hafta + 2 kunlik chala hafta
  const rows: [number, number, number, number][] = Array.from({ length: 12 }, (_, i) => [
    100 + i,
    105 + i,
    95 + i,
    101 + i,
  ]);
  const daily = candles(rows);

  it('to\'liq haftalarni OHLC ga yig\'adi, chala oxirgi haftani tashlaydi', () => {
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toEqual({ timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 109, low: 95, close: 105 });
    expect(weekly[1]).toMatchObject({ open: 105, high: 114, low: 100, close: 110 });
  });

  it('oxirgi hafta juma bilan tugasa u ham olinadi', () => {
    expect(aggregateWeekly(daily.slice(0, 10))).toHaveLength(2);
  });
});
