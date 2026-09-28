import type { BacktestEvent } from './walkForward';

export type Rates = {
  events: number;
  successRate: number;
  failRate: number;
  neutralRate: number;
  avgReactionAtr: number;
};

export type Summary = {
  real: Rates;
  control: Rates;
  edge: number; // real.successRate − control.successRate
  z: number; // ikki ulush farqi z-testi; |z| > 2 ≈ 95% ishonch bilan tasodif emas
  failEdge: number; // real.failRate − control.failRate (breakout gipotezasi uchun)
  failZ: number;
};

function rates(all: BacktestEvent[]): Rates {
  const events = all.filter((e) => e.outcome !== 'pending');
  const n = events.length;
  const share = (o: BacktestEvent['outcome']) => (n ? events.filter((e) => e.outcome === o).length / n : NaN);
  return {
    events: n,
    successRate: share('success'),
    failRate: share('fail'),
    neutralRate: share('neutral'),
    avgReactionAtr: n ? events.reduce((acc, e) => acc + (e.reactionAtr ?? 0), 0) / n : NaN,
  };
}

// Ikki mustaqil ulush farqi uchun z (umumiy ulush bilan)
function twoProportionZ(p1: number, n1: number, p2: number, n2: number): number {
  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  return se > 0 ? (p1 - p2) / se : 0;
}

export function summarize(events: BacktestEvent[]): Summary {
  const real = rates(events.filter((e) => !e.control));
  const control = rates(events.filter((e) => e.control));
  return {
    real,
    control,
    edge: real.successRate - control.successRate,
    z: twoProportionZ(real.successRate, real.events, control.successRate, control.events),
    failEdge: real.failRate - control.failRate,
    failZ: twoProportionZ(real.failRate, real.events, control.failRate, control.events),
  };
}
