import type { AlgoParams } from './config';
import type { Candle, Zone, ZoneScores } from './types';
import { isSupplyDemand } from './zone';

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS;
}

// S/R: har bir touch kuchaytiradi, lekin ta'siri kamayib boradi (1→50, 2→75, 3→87.5, ...)
export function touchScore(touches: number): number {
  return 100 * (1 - 0.5 ** touches);
}

// S/D: test qilinmagan zona eng kuchli, har bir test ballni kamaytiradi
export function freshnessScore(tests: number, staleTests: number): number {
  return Math.max(0, 100 * (1 - tests / (staleTests + 1)));
}

export function ageFactor(ageDays: number, maxAgeDays: number): number {
  return ageDays <= maxAgeDays ? 1 : Math.exp(-(ageDays - maxAgeDays) / maxAgeDays);
}

export function recencyFactor(daysSince: number, halfLifeDays: number): number {
  return 0.5 ** (Math.max(0, daysSince) / halfLifeDays);
}

export function totalScore(
  sr: number,
  sd: number,
  tf: number,
  isSuper: boolean,
  scoring: AlgoParams['scoring'],
): number {
  const { weights, superBonus } = scoring;
  const total = sr * weights.sr + sd * weights.sd + tf * weights.tf + (isSuper ? superBonus : 0);
  return Math.min(100, Math.max(0, total));
}

export function scoreZone(
  zone: Zone,
  candles: Candle[],
  asOfIndex: number,
  hasTfConfluence: boolean,
  params: AlgoParams,
): ZoneScores {
  if (zone.status === 'invalid') return { sr: 0, sd: 0, tf: 0, total: 0 };

  const { maxAgeDays, recencyHalfLifeDays } = params.scoring;
  const asOf = candles[asOfIndex].timestamp;
  const age = ageFactor(daysBetween(candles[zone.formedIndex].timestamp, asOf), maxAgeDays);

  let sr = 0;
  let sd = 0;
  if (zone.kind === 'sr') {
    const lastTouch = Math.max(zone.lastSwingIndex ?? zone.formedIndex, zone.tests.at(-1)?.index ?? -1);
    const recency = recencyFactor(daysBetween(candles[lastTouch].timestamp, asOf), recencyHalfLifeDays);
    sr = touchScore(zone.swingPrices.length) * (0.5 + 0.5 * recency) * age;
  }
  if (isSupplyDemand(zone)) {
    sd = freshnessScore(zone.tests.length, params.staleTests) * age;
  }
  const tf = hasTfConfluence ? 100 : 0;
  return { sr, sd, tf, total: totalScore(sr, sd, tf, false, params.scoring) };
}
