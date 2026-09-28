import { analyze, type AlgoParams, type Candle, type Side, type Zone } from '../zones';
import { candleOverlaps } from '../zones/zone';
import { shadowOffset } from './baseline';
import { measureOutcome, type Outcome } from './outcome';

export type ProvidedZone = Pick<Zone, 'kind' | 'top' | 'bottom' | 'formedIndex' | 'atrAtFormation'> & {
  score: number;
};

// t-kun uchun foydalanuvchiga ko'rinadigan zonalar va ATR — faqat 0..t-1 ma'lumotdan
export type ZoneProvider = (t: number) => { zones: ProvidedZone[]; atr: number | null };

export function algorithmProvider(candles: Candle[], params: AlgoParams): ZoneProvider {
  return (t) => {
    const known = analyze(candles.slice(0, t), params);
    return {
      atr: known.atr[t - 1] ?? null,
      zones: known.zones
        .filter((z) => z.status !== 'invalid')
        .map((z) => ({
          kind: z.kind,
          top: z.top,
          bottom: z.bottom,
          formedIndex: z.formedIndex,
          atrAtFormation: z.atrAtFormation,
          score: z.scores.total,
        })),
    };
  };
}

export type BacktestEvent = {
  index: number; // zonaga kirgan sham
  control: boolean; // true — soya (tasodifiy siljitilgan) zona
  kind: Zone['kind']; // soya uchun — asl zonaniki
  score: number; // kirishdan oldingi kun holatiga
  approach: Side;
  widthAtr: number;
  outcome: Outcome;
  reactionAtr: number | null;
};

export type WalkForwardOptions = {
  from?: number;
  to?: number;
  provider?: ZoneProvider;
  shadowsPerZone?: number;
  seed?: number;
  onProgress?: (index: number) => void;
};

// Har bir t-kun uchun faqat 0..t-1 dan olingan zonalar ko'riladi. t-sham zonaga yangi
// kirsa (oldingi sham tegmagan) — hodisa; natija t..t+oyna shamlari bo'yicha o'lchanadi.
// Xuddi shu qoida soya zonalarga ham qo'llanadi — ular nazorat guruhi.
export function collectEvents(candles: Candle[], params: AlgoParams, options: WalkForwardOptions = {}): BacktestEvent[] {
  const from = Math.max(options.from ?? 1, 1);
  const to = Math.min(options.to ?? candles.length - 1, candles.length - 1);
  const provider = options.provider ?? algorithmProvider(candles, params);
  const shadows = options.shadowsPerZone ?? 5;
  const seed = options.seed ?? 1;
  const events: BacktestEvent[] = [];

  for (let t = from; t <= to; t++) {
    const { zones, atr } = provider(t);
    options.onProgress?.(t);
    if (atr === null) continue;

    const prev = candles[t - 1];
    const cur = candles[t];
    const tryEvent = (zone: ProvidedZone, top: number, bottom: number, control: boolean) => {
      if (candleOverlaps(prev, top, bottom) || !candleOverlaps(cur, top, bottom)) return;
      const approach: Side = prev.low > top ? 'above' : 'below';
      events.push({
        index: t,
        control,
        kind: zone.kind,
        score: zone.score,
        approach,
        widthAtr: (top - bottom) / atr,
        ...measureOutcome(candles, t, approach, top, bottom, atr, params),
      });
    };

    for (const zone of zones) {
      tryEvent(zone, zone.top, zone.bottom, false);
      for (let k = 0; k < shadows; k++) {
        const offset = shadowOffset(zone, k, seed);
        tryEvent(zone, zone.top + offset, zone.bottom + offset, true);
      }
    }
  }
  return events;
}
