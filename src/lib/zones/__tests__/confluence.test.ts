import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../config';
import { buildSuperZones, hasTfConfluence } from '../confluence';
import { zone } from './helpers';

const scores = (sr: number, sd: number, tf = 0) => ({ sr, sd, tf, total: 0 });

describe('buildSuperZones', () => {
  it('bir joydagi S/R va S/D zona super-zonaga birlashadi', () => {
    const sr = zone({ kind: 'sr', top: 102, bottom: 100, formedIndex: 3, confirmedIndex: 8, swingPrices: [101], scores: scores(75, 0) });
    const demand = zone({ kind: 'demand', top: 103, bottom: 101, formedIndex: 5, confirmedIndex: 6, scores: scores(0, 100, 100) });
    const far = zone({ kind: 'sr', top: 202, bottom: 200, scores: scores(50, 0) });

    const result = buildSuperZones([sr, demand, far], 1, DEFAULT_PARAMS);

    expect(result).toHaveLength(2);
    const sup = result.find((z) => z.kind === 'super')!;
    expect(sup).toMatchObject({ top: 103, bottom: 100, formedIndex: 3, confirmedIndex: 8 });
    // 75×0.4 + 100×0.4 + 100×0.2 + 10 bonus = 100
    expect(sup.scores).toEqual({ sr: 75, sd: 100, tf: 100, total: 100 });
    expect(result).toContain(far);
  });

  it('uzoqdagi zonalar birlashmaydi', () => {
    const sr = zone({ kind: 'sr', top: 102, bottom: 100 });
    const supply = zone({ kind: 'supply', top: 110, bottom: 108 });
    expect(buildSuperZones([sr, supply], 1, DEFAULT_PARAMS)).toEqual([sr, supply]);
  });

  it('bekor qilingan zonalar birlashmaydi', () => {
    const sr = zone({ kind: 'sr', top: 102, bottom: 100, status: 'invalid', invalidatedIndex: 1 });
    const demand = zone({ kind: 'demand', top: 103, bottom: 101 });
    expect(buildSuperZones([sr, demand], 1, DEFAULT_PARAMS)).toEqual([sr, demand]);
  });

  it('har bir S/D faqat eng yaqin S/R bilan juftlanadi', () => {
    const near = zone({ kind: 'sr', top: 101, bottom: 100 });
    const lessNear = zone({ kind: 'sr', top: 104, bottom: 103 });
    const demand = zone({ kind: 'demand', top: 102, bottom: 100.5 });
    const result = buildSuperZones([near, lessNear, demand], 2, DEFAULT_PARAMS);
    expect(result).toContain(lessNear);
    expect(result.filter((z) => z.kind === 'super')).toHaveLength(1);
  });
});

describe('hasTfConfluence', () => {
  it('haftalik tirik zona yaqinida bo\'lsa true', () => {
    const daily = zone({ kind: 'sr', top: 102, bottom: 100 });
    expect(hasTfConfluence(daily, [zone({ kind: 'sr', top: 104, bottom: 102.5 })], 1)).toBe(true);
    expect(hasTfConfluence(daily, [zone({ kind: 'sr', top: 110, bottom: 108 })], 1)).toBe(false);
    expect(
      hasTfConfluence(daily, [zone({ kind: 'sr', top: 102, bottom: 100, status: 'invalid', invalidatedIndex: 0 })], 1),
    ).toBe(false);
  });
});
