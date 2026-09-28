import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../config';
import { ageFactor, freshnessScore, recencyFactor, scoreZone, totalScore, touchScore } from '../scoring';
import { candles, zone } from './helpers';

describe('ball komponentlari', () => {
  it('S/R: har touch kuchaytiradi, lekin ta\'siri kamayadi', () => {
    const scores = [1, 2, 3, 4].map(touchScore);
    expect(scores).toEqual([50, 75, 87.5, 93.75]);
    expect(scores[1] - scores[0]).toBeGreaterThan(scores[3] - scores[2]);
  });

  it('S/D: test qilinmagan zona eng kuchli, har test kamaytiradi', () => {
    expect([0, 1, 2, 3, 4].map((t) => freshnessScore(t, 3))).toEqual([100, 75, 50, 25, 0]);
  });

  it('yosh: maxAgeDays gacha 1, keyin pasayadi', () => {
    expect(ageFactor(300, 300)).toBe(1);
    expect(ageFactor(600, 300)).toBeCloseTo(Math.exp(-1));
  });

  it('recency: half-life da yarmiga tushadi', () => {
    expect(recencyFactor(0, 90)).toBe(1);
    expect(recencyFactor(90, 90)).toBeCloseTo(0.5);
  });

  it('yakuniy formula: sr×0.4 + sd×0.4 + tf×0.2 (+ super bonus), 100 bilan cheklangan', () => {
    expect(totalScore(50, 0, 100, false, DEFAULT_PARAMS.scoring)).toBe(40);
    expect(totalScore(100, 100, 100, true, DEFAULT_PARAMS.scoring)).toBe(100);
    expect(totalScore(50, 50, 0, true, DEFAULT_PARAMS.scoring)).toBe(50);
  });
});

describe('scoreZone', () => {
  const data = candles(Array.from({ length: 10 }, () => [100, 101, 99, 100]));

  it('S/R zonada faqat sr, S/D zonada faqat sd hisoblanadi', () => {
    const sr = scoreZone(zone({ kind: 'sr', top: 1, bottom: 0, swingPrices: [1], lastSwingIndex: 9, formedIndex: 9 }), data, 9, false, DEFAULT_PARAMS);
    expect(sr).toEqual({ sr: 50, sd: 0, tf: 0, total: 20 });

    const sd = scoreZone(zone({ kind: 'demand', top: 1, bottom: 0, formedIndex: 9 }), data, 9, true, DEFAULT_PARAMS);
    expect(sd).toEqual({ sr: 0, sd: 100, tf: 100, total: 60 });
  });

  it('bekor qilingan zona 0 ball oladi', () => {
    const z = zone({ kind: 'demand', top: 1, bottom: 0, status: 'invalid', invalidatedIndex: 5 });
    expect(scoreZone(z, data, 9, true, DEFAULT_PARAMS).total).toBe(0);
  });
});
