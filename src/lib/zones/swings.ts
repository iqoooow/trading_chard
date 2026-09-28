import type { Candle, SwingPoint } from './types';

// Fraktal swing: sham chapdagi N shamdan qat'iy, o'ngdagi N shamdan kamida teng
// darajada ekstremal. Teng cho'qqilarda (double top) faqat birinchisi olinadi.
// Swing faqat o'ngdagi N sham yopilgandan keyin ma'lum bo'ladi (confirmedIndex).
export function findSwings(candles: Candle[], n: number): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = n; i < candles.length - n; i++) {
    const { high, low } = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - n; j <= i + n && (isHigh || isLow); j++) {
      if (j === i) continue;
      const left = j < i;
      if (left ? candles[j].high >= high : candles[j].high > high) isHigh = false;
      if (left ? candles[j].low <= low : candles[j].low < low) isLow = false;
    }

    if (isHigh) swings.push({ index: i, confirmedIndex: i + n, type: 'high', price: high });
    if (isLow) swings.push({ index: i, confirmedIndex: i + n, type: 'low', price: low });
  }
  return swings;
}
