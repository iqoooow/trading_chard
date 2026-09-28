import type { Candle, Zone, ZoneKind } from './types';

type ZoneInit = {
  kind: ZoneKind;
  top: number;
  bottom: number;
  formedIndex: number;
  confirmedIndex: number;
  atrAtFormation: number;
} & Partial<Omit<Zone, 'kind' | 'top' | 'bottom' | 'formedIndex' | 'confirmedIndex' | 'atrAtFormation'>>;

export function createZone(init: ZoneInit): Zone {
  return {
    swingPrices: [],
    lastSwingIndex: null,
    tests: [],
    status: 'active',
    invalidatedIndex: null,
    clearSide: null,
    scores: { sr: 0, sd: 0, tf: 0, total: 0 },
    ...init,
  };
}

export function candleOverlaps(candle: Candle, top: number, bottom: number): boolean {
  return candle.low <= top && candle.high >= bottom;
}

// Ikki narx oralig'i bir-biriga `distance` dan yaqinmi (kesishsa ham true)
export function rangesNear(
  a: { top: number; bottom: number },
  b: { top: number; bottom: number },
  distance: number,
): boolean {
  return a.bottom - distance <= b.top && b.bottom - distance <= a.top;
}

export function isSupplyDemand(zone: Zone): boolean {
  return zone.kind === 'supply' || zone.kind === 'demand';
}
