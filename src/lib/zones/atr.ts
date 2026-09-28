import type { Candle } from './types';

export function trueRange(candle: Candle, prev?: Candle): number {
  if (!prev) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - prev.close),
    Math.abs(candle.low - prev.close),
  );
}

// Wilder ATR. Birinchi period-1 ta qiymat null — ular uchun ATR hali hisoblanmaydi.
export function computeAtr(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += trueRange(candles[i], candles[i - 1]);
  let atr = sum / period;
  out[period - 1] = atr;

  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRange(candles[i], candles[i - 1])) / period;
    out[i] = atr;
  }
  return out;
}
