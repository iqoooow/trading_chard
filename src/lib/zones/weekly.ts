import type { Candle } from './types';

// Hafta dushanbadan boshlanadi (UTC). Kalit — dushanba sanasi.
export function weekKey(timestamp: string): string {
  const d = new Date(timestamp);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday))
    .toISOString()
    .slice(0, 10);
}

// Kunlik shamlardan haftalik shamlar. Oxirgi hafta juma shami bilan tugamagan bo'lsa,
// u hali yopilmagan — tashlab yuboriladi (look-ahead va chala sham bo'lmasligi uchun).
export function aggregateWeekly(daily: Candle[]): Candle[] {
  const weeks: { key: string; candles: Candle[] }[] = [];
  for (const candle of daily) {
    const key = weekKey(candle.timestamp);
    const last = weeks.at(-1);
    if (last && last.key === key) last.candles.push(candle);
    else weeks.push({ key, candles: [candle] });
  }

  const lastWeek = weeks.at(-1);
  if (lastWeek && new Date(lastWeek.candles.at(-1)!.timestamp).getUTCDay() !== 5) weeks.pop();

  return weeks.map(({ key, candles }) => ({
    timestamp: `${key}T00:00:00.000Z`,
    open: candles[0].open,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
    close: candles.at(-1)!.close,
  }));
}
