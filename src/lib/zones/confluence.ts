import type { AlgoParams } from './config';
import { totalScore } from './scoring';
import type { Zone, ZoneTest } from './types';
import { createZone, isSupplyDemand, rangesNear } from './zone';

const isLive = (zone: Zone) => zone.status !== 'invalid';
const mid = (zone: Zone) => (zone.top + zone.bottom) / 2;

// Kunlik zona yuqori timeframe'dagi (haftalik) tirik zona bilan bir joyda turibdimi
export function hasTfConfluence(zone: Zone, higherTfZones: Zone[], distance: number): boolean {
  return higherTfZones.some((w) => isLive(w) && rangesNear(zone, w, distance));
}

// Har bir tirik S/D zona o'ziga eng yaqin tirik S/R zona bilan juftlanadi (masofa ATR asosida).
// S/R zona va unga juftlangan S/D zonalar bitta super-zonaga almashtiriladi.
// Juftlash faqat S/R↔S/D bo'yicha — zanjir bo'lib cheksiz kattalashib ketmaydi.
export function buildSuperZones(zones: Zone[], distance: number, params: AlgoParams): Zone[] {
  const groups = new Map<Zone, Zone[]>();

  for (const sd of zones) {
    if (!isSupplyDemand(sd) || !isLive(sd)) continue;
    let best: Zone | null = null;
    let bestDistance = Infinity;
    for (const sr of zones) {
      if (sr.kind !== 'sr' || !isLive(sr) || !rangesNear(sd, sr, distance)) continue;
      const d = Math.abs(mid(sd) - mid(sr));
      if (d < bestDistance) {
        best = sr;
        bestDistance = d;
      }
    }
    if (best) groups.set(best, [...(groups.get(best) ?? []), sd]);
  }

  if (groups.size === 0) return zones;

  const merged = new Set<Zone>();
  const supers: Zone[] = [];
  for (const [sr, sds] of groups) {
    [sr, ...sds].forEach((z) => merged.add(z));
    supers.push(mergeIntoSuper(sr, sds, params));
  }
  return [...zones.filter((z) => !merged.has(z)), ...supers].sort((a, b) => a.formedIndex - b.formedIndex);
}

function mergeIntoSuper(sr: Zone, sds: Zone[], params: AlgoParams): Zone {
  const members = [sr, ...sds];

  const testsByIndex = new Map<number, ZoneTest>();
  for (const m of members) for (const t of m.tests) if (!testsByIndex.has(t.index)) testsByIndex.set(t.index, t);

  const sd = Math.max(...sds.map((z) => z.scores.sd));
  const tf = Math.max(...members.map((z) => z.scores.tf));

  return createZone({
    kind: 'super',
    top: Math.max(...members.map((z) => z.top)),
    bottom: Math.min(...members.map((z) => z.bottom)),
    formedIndex: Math.min(...members.map((z) => z.formedIndex)),
    confirmedIndex: Math.max(...members.map((z) => z.confirmedIndex)),
    atrAtFormation: sr.atrAtFormation,
    swingPrices: [...sr.swingPrices],
    lastSwingIndex: sr.lastSwingIndex,
    tests: [...testsByIndex.values()].sort((a, b) => a.index - b.index),
    status: members.some((z) => z.status === 'active') ? 'active' : 'stale',
    scores: { sr: sr.scores.sr, sd, tf, total: totalScore(sr.scores.sr, sd, tf, true, params.scoring) },
  });
}
