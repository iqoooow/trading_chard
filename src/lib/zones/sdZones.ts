import type { AlgoParams } from './config';
import type { Candle, Zone } from './types';
import { createZone } from './zone';

const body = (c: Candle) => Math.abs(c.close - c.open);

// i-sham impuls bo'lsa va undan oldin 1..baseMaxCandles ta baza sham bo'lsa — zona.
// O'lchov uchun impulsdan oldingi ATR (atr[i-1]) ishlatiladi, aks holda impulsning
// o'zi ATR ni oshirib, o'zini o'lchab qo'ygan bo'lardi.
export function detectSupplyDemand(
  candles: Candle[],
  atr: (number | null)[],
  i: number,
  params: AlgoParams['sd'],
): Zone | null {
  const a = i > 0 ? atr[i - 1] : null;
  if (a === null || a <= 0) return null;

  const impulse = candles[i];
  if (body(impulse) < params.impulseMinBodyAtr * a) return null;

  let start = i;
  while (
    start - 1 >= 0 &&
    i - (start - 1) <= params.baseMaxCandles &&
    body(candles[start - 1]) < params.baseMaxBodyAtr * a
  ) {
    start--;
  }
  if (start === i) return null;

  // Zona chegarasi — baza shamlarining fitillari bilan birga
  let top = -Infinity;
  let bottom = Infinity;
  for (let j = start; j < i; j++) {
    top = Math.max(top, candles[j].high);
    bottom = Math.min(bottom, candles[j].low);
  }

  const up = impulse.close > impulse.open;
  // Impuls bazadan chiqib ketishi kerak, aks holda bu shunchaki katta sham
  if (up ? impulse.close <= top : impulse.close >= bottom) return null;

  return createZone({
    kind: up ? 'demand' : 'supply',
    top,
    bottom,
    formedIndex: start,
    confirmedIndex: i,
    atrAtFormation: a,
    clearSide: up ? 'above' : 'below',
  });
}
