// Bazadagi shamlar ustida algoritmni ishga tushirib, natijani konsolga chiqaradi.
// Bazaga hech narsa yozmaydi. Ishga tushirish: npm run analyze
import { createClient } from '@supabase/supabase-js';
import { loadCandles } from '../src/lib/candles';
import { ALGO_VERSION, analyze, DEFAULT_PARAMS, type Zone } from '../src/lib/zones';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const candles = await loadCandles(supabase, 'XAU/USD', 'Daily');
const started = performance.now();
const result = analyze(candles, DEFAULT_PARAMS);
const elapsed = performance.now() - started;

const last = candles.at(-1)!;
const atr = result.atr.at(-1)!;
const date = (i: number) => candles[i].timestamp.slice(0, 10);
const count = <T,>(items: T[], key: (x: T) => string) =>
  items.reduce<Record<string, number>>((acc, x) => ({ ...acc, [key(x)]: (acc[key(x)] ?? 0) + 1 }), {});

console.log(`Algoritm v${ALGO_VERSION}: ${candles.length} sham (${date(0)} → ${date(candles.length - 1)}), ${elapsed.toFixed(0)} ms`);
console.log(`Oxirgi yopilish: ${last.close.toFixed(2)}, ATR(14): ${atr.toFixed(2)}`);
console.log(`Swinglar: ${result.swings.length}, haftalik zonalar: ${result.weeklyZones.length}`);
console.log('Zonalar turi bo\'yicha:', count(result.zones, (z) => z.kind));
console.log('Zonalar holati bo\'yicha:', count(result.zones, (z) => z.status));

const tests = result.zones.flatMap((z) => z.tests);
console.log(`Testlar: ${tests.length}`, count(tests, (t) => t.reactionType));

// Joriy narxga eng yaqin tirik zonalar (±5 ATR)
const near = result.zones
  .filter((z) => z.status !== 'invalid' && Math.abs((z.top + z.bottom) / 2 - last.close) < 5 * atr)
  .sort((a, b) => b.top - a.top);

const row = (z: Zone) => ({
  tur: z.kind,
  holat: z.status,
  yuqori: z.top.toFixed(2),
  past: z.bottom.toFixed(2),
  'narxdan (ATR)': (((z.top + z.bottom) / 2 - last.close) / atr).toFixed(1),
  shakllangan: date(z.formedIndex),
  touch: z.swingPrices.length,
  test: z.tests.length,
  sr: z.scores.sr.toFixed(0),
  sd: z.scores.sd.toFixed(0),
  tf: z.scores.tf.toFixed(0),
  ball: z.scores.total.toFixed(1),
});

console.log(`\nJoriy narx (${last.close.toFixed(2)}) atrofidagi tirik zonalar (±5 ATR):`);
console.table(near.map(row));

console.log('\nEng yuqori balli 10 ta tirik zona:');
console.table(
  result.zones
    .filter((z) => z.status !== 'invalid')
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, 10)
    .map(row),
);
