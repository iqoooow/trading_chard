import type { AlgoParams } from './config';
import type { SwingPoint, Zone } from './types';
import { createZone } from './zone';

function center(zone: Zone): number {
  return zone.swingPrices.reduce((sum, p) => sum + p, 0) / zone.swingPrices.length;
}

// Swing narxi markazidan mergeAtr × ATR dan yaqin bo'lgan eng yaqin tirik S/R zona.
// Bekor qilingan zona yangi swinglarni qabul qilmaydi — o'sha darajada yangi zona ochiladi.
export function findSrMergeTarget(
  zones: Zone[],
  price: number,
  atr: number,
  mergeAtr: number,
): Zone | null {
  let best: Zone | null = null;
  let bestDistance = mergeAtr * atr;
  for (const zone of zones) {
    if (zone.kind !== 'sr' || zone.status === 'invalid') continue;
    const distance = Math.abs(price - center(zone));
    if (distance < bestDistance) {
      best = zone;
      bestDistance = distance;
    }
  }
  return best;
}

function applyBounds(zone: Zone, bufferAtr: number) {
  const buffer = bufferAtr * zone.atrAtFormation;
  zone.top = Math.max(...zone.swingPrices) + buffer;
  zone.bottom = Math.min(...zone.swingPrices) - buffer;
}

export function createSrZone(swing: SwingPoint, atr: number, params: AlgoParams): Zone {
  const zone = createZone({
    kind: 'sr',
    top: swing.price,
    bottom: swing.price,
    formedIndex: swing.index,
    confirmedIndex: swing.confirmedIndex,
    atrAtFormation: atr,
    swingPrices: [swing.price],
    lastSwingIndex: swing.index,
  });
  applyBounds(zone, params.sr.bufferAtr);
  return zone;
}

export function addSwingToZone(zone: Zone, swing: SwingPoint, params: AlgoParams) {
  zone.swingPrices.push(swing.price);
  zone.lastSwingIndex = Math.max(zone.lastSwingIndex ?? swing.index, swing.index);
  applyBounds(zone, params.sr.bufferAtr);
}
