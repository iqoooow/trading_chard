import type { AlgoParams } from './config';
import type { Candle, Side, Zone, ZoneTest } from './types';
import { candleOverlaps } from './zone';

// Zonaga yangi kirish: oldingi sham zonaga tegmagan, bu sham tegadi.
// Zona tasdiqlangan shamdan keyingina hisoblanadi.
export function detectEntry(candles: Candle[], i: number, zone: Zone): Side | null {
  if (i <= zone.confirmedIndex || i === 0) return null;
  const prev = candles[i - 1];
  if (candleOverlaps(prev, zone.top, zone.bottom)) return null;
  if (!candleOverlaps(candles[i], zone.top, zone.bottom)) return null;
  return prev.low > zone.top ? 'above' : 'below';
}

// Testdan keyingi windowCandles sham ichidagi reaksiya:
// - narx zona orqali qarama-qarshi tomonga aniq yopilsa va undan oldin bounceMinAtr
//   miqdorida qaytmagan bo'lsa → 'break'
// - aks holda zona ushlab turdi → 'bounce' (kuchi reactionAtr da)
// - oyna hali tugamagan bo'lsa → 'pending'
export function resolveReaction(candles: Candle[], test: ZoneTest, params: AlgoParams) {
  const { windowCandles, bounceMinAtr } = params.reaction;
  const fromAbove = test.approach === 'above';
  let maxFavorable = 0;

  for (let k = 0; k <= windowCandles; k++) {
    const j = test.index + k;
    if (j >= candles.length) {
      test.reactionType = 'pending';
      test.reactionAtr = k > 1 ? maxFavorable : null;
      return;
    }
    const c = candles[j];
    if (k > 0) {
      const move = fromAbove ? c.high - test.zoneTop : test.zoneBottom - c.low;
      maxFavorable = Math.max(maxFavorable, move / test.atr);
    }
    const broken = fromAbove
      ? c.close < test.zoneBottom - params.breakCloseAtr * test.atr
      : c.close > test.zoneTop + params.breakCloseAtr * test.atr;
    if (broken) {
      test.reactionType = maxFavorable >= bounceMinAtr ? 'bounce' : 'break';
      test.reactionAtr = maxFavorable;
      return;
    }
  }
  test.reactionType = 'bounce';
  test.reactionAtr = maxFavorable;
}
