import { computeAtr } from './atr';
import { type AlgoParams, DEFAULT_PARAMS } from './config';
import { buildSuperZones, hasTfConfluence } from './confluence';
import { detectEntry, resolveReaction } from './interactions';
import { applyClose, updateStaleness } from './invalidation';
import { scoreZone } from './scoring';
import { detectSupplyDemand } from './sdZones';
import { addSwingToZone, createSrZone, findSrMergeTarget } from './srZones';
import { findSwings } from './swings';
import type { Candle, SwingPoint, Zone } from './types';
import { aggregateWeekly } from './weekly';

export type AnalysisResult = {
  candles: Candle[];
  atr: (number | null)[];
  swings: SwingPoint[];
  zones: Zone[];
  weeklyZones: Zone[];
};

export type AnalyzeOptions = {
  includeWeekly?: boolean;
};

// Shamlar bo'ylab xronologik (walk-forward) yurish. t-shamda faqat 0..t ma'lumotlari
// ishlatiladi: avval mavjud zonalar test/invalidatsiya qilinadi, keyin shu shamda
// tasdiqlangan swing va S/D zonalar qo'shiladi.
export function simulateZones(
  candles: Candle[],
  atr: (number | null)[],
  swings: SwingPoint[],
  params: AlgoParams,
): Zone[] {
  const swingsByConfirm = new Map<number, SwingPoint[]>();
  for (const s of swings) {
    swingsByConfirm.set(s.confirmedIndex, [...(swingsByConfirm.get(s.confirmedIndex) ?? []), s]);
  }

  const zones: Zone[] = [];
  for (let t = 0; t < candles.length; t++) {
    const a = atr[t];
    if (a === null) continue;

    for (const zone of zones) {
      if (zone.status === 'invalid' || zone.confirmedIndex >= t) continue;
      const approach = detectEntry(candles, t, zone);
      if (approach) {
        zone.tests.push({
          index: t,
          approach,
          zoneTop: zone.top,
          zoneBottom: zone.bottom,
          atr: a,
          reactionType: 'pending',
          reactionAtr: null,
        });
        updateStaleness(zone, params);
      }
      applyClose(zone, t, candles[t].close, a, params.breakCloseAtr);
    }

    for (const swing of swingsByConfirm.get(t) ?? []) {
      const target = findSrMergeTarget(zones, swing.price, a, params.sr.mergeAtr);
      if (target) {
        addSwingToZone(target, swing, params);
      } else {
        const zone = createSrZone(swing, a, params);
        applyClose(zone, t, candles[t].close, a, params.breakCloseAtr);
        zones.push(zone);
      }
    }

    const sd = detectSupplyDemand(candles, atr, t, params.sd);
    if (sd) zones.push(sd);
  }
  return zones;
}

// To'liq tahlil: zonalar, reaksiyalar, ballar va super-zonalar — oxirgi sham holatiga.
// Backtestda shamlarning prefiksi (0..t) beriladi, shuning uchun kelajak ma'lumoti
// hech qachon ishlatilmaydi.
export function analyze(
  candles: Candle[],
  params: AlgoParams = DEFAULT_PARAMS,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const includeWeekly = options.includeWeekly ?? true;
  const atr = computeAtr(candles, params.atrPeriod);
  const swings = findSwings(candles, params.swingN);
  const zones = simulateZones(candles, atr, swings, params);

  for (const zone of zones) for (const test of zone.tests) resolveReaction(candles, test, params);

  const weeklyZones = includeWeekly
    ? analyze(aggregateWeekly(candles), { ...params, swingN: params.weeklySwingN }, { includeWeekly: false }).zones
    : [];

  const asOfIndex = candles.length - 1;
  const atrNow = atr[asOfIndex] ?? 0;
  const distance = params.superMergeAtr * atrNow;
  for (const zone of zones) {
    zone.scores = scoreZone(zone, candles, asOfIndex, hasTfConfluence(zone, weeklyZones, distance), params);
  }

  return { candles, atr, swings, zones: buildSuperZones(zones, distance, params), weeklyZones };
}
