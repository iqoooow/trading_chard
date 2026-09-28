import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../config';
import { detectSupplyDemand } from '../sdZones';
import type { Candle } from '../types';
import { candles } from './helpers';

// ATR = 10 → baza tanasi < 3, impuls tanasi >= 15
const ATR = 10;
const atrOf = (data: Candle[]) => data.map(() => ATR);

const base: [number, number, number, number][] = [
  [90, 101, 89, 100], // tanasi 10 — baza emas
  [100, 104, 97, 101],
  [101, 103, 98, 100],
  [100, 102, 99, 101],
];

describe('detectSupplyDemand', () => {
  it('baza + yuqoriga impuls → demand, chegaralar baza fitillari bo\'yicha', () => {
    const data = candles([...base, [101, 125, 100, 122]]);
    const zone = detectSupplyDemand(data, atrOf(data), 4, DEFAULT_PARAMS.sd);
    expect(zone).toMatchObject({
      kind: 'demand',
      top: 104,
      bottom: 97,
      formedIndex: 1,
      confirmedIndex: 4,
      clearSide: 'above',
    });
  });

  it('baza + pastga impuls → supply', () => {
    const data = candles([...base, [101, 102, 78, 80]]);
    const zone = detectSupplyDemand(data, atrOf(data), 4, DEFAULT_PARAMS.sd);
    expect(zone).toMatchObject({ kind: 'supply', top: 104, bottom: 97, clearSide: 'below' });
  });

  it('baza ko\'pi bilan baseMaxCandles sham', () => {
    const data = candles([[100, 101, 99, 100], ...base.slice(1), [100, 102, 99, 101], [101, 125, 100, 122]]);
    const zone = detectSupplyDemand(data, atrOf(data), 5, DEFAULT_PARAMS.sd);
    expect(zone?.formedIndex).toBe(2); // 5 − 3
  });

  it('impuls kichik bo\'lsa zona yo\'q', () => {
    const data = candles([...base, [101, 110, 100, 110]]);
    expect(detectSupplyDemand(data, atrOf(data), 4, DEFAULT_PARAMS.sd)).toBeNull();
  });

  it('impuldan oldin baza bo\'lmasa zona yo\'q', () => {
    const data = candles([...base.slice(0, 3), [100, 110, 99, 109], [109, 135, 108, 132]]);
    expect(detectSupplyDemand(data, atrOf(data), 4, DEFAULT_PARAMS.sd)).toBeNull();
  });

  it('impuls bazadan chiqib ketmasa zona yo\'q', () => {
    const data = candles([...base, [85, 104, 84, 101]]);
    expect(detectSupplyDemand(data, atrOf(data), 4, DEFAULT_PARAMS.sd)).toBeNull();
  });

  it('ATR hali yo\'q bo\'lsa zona yo\'q', () => {
    const data = candles([...base, [101, 125, 100, 122]]);
    expect(detectSupplyDemand(data, data.map(() => null), 4, DEFAULT_PARAMS.sd)).toBeNull();
  });
});
