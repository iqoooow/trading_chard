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

export function summarize(events: BacktestEvent[]): Summary {
  const real = rates(events.filter((e) => !e.control));
  const control = rates(events.filter((e) => e.control));
  const edge = real.successRate - control.successRate;

  const n1 = real.events;
  const n2 = control.events;
  const pooled = (real.successRate * n1 + control.successRate * n2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  return { real, control, edge, z: se > 0 ? edge / se : 0 };
}
