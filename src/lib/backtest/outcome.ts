import type { AlgoParams, Candle, Side, ZoneTest } from '../zones';
import { resolveReaction } from '../zones/interactions';

// success — zona buzilishidan oldin kamida bounceMinAtr × ATR qarama-qarshi harakat
// fail    — zona buzildi (qarama-qarshi tomonda aniq yopilish) va undan oldin qaytmadi
// neutral — oyna ichida na qaytish, na buzilish
// pending — oyna hali tugamagan (ma'lumot oxiri)
export type Outcome = 'success' | 'fail' | 'neutral' | 'pending';

export type MeasuredOutcome = { outcome: Outcome; reactionAtr: number | null };

// Engine'dagi reaksiya qoidasini qayta ishlatadi — backtest va bazadagi zone_tests bir xil o'lchanadi
export function measureOutcome(
  candles: Candle[],
  index: number,
  approach: Side,
  top: number,
  bottom: number,
  atr: number,
  params: AlgoParams,
): MeasuredOutcome {
  const test: ZoneTest = {
    index,
    approach,
    zoneTop: top,
    zoneBottom: bottom,
    atr,
    reactionType: 'pending',
    reactionAtr: null,
  };
  resolveReaction(candles, test, params);

  const outcome: Outcome =
    test.reactionType === 'pending'
      ? 'pending'
      : test.reactionType === 'break'
        ? 'fail'
        : (test.reactionAtr ?? 0) >= params.reaction.bounceMinAtr
          ? 'success'
          : 'neutral';
  return { outcome, reactionAtr: test.reactionAtr };
}
