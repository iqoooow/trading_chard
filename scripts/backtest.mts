// Walk-forward backtest: zonalar tasodifiy darajalardan yaxshiroq ishlaydimi?
//
//   npm run backtest            — joriy parametrlar, train (70%) va test (30%) natijasi
//   npm run backtest -- --sweep — parametrlarni FAQAT train qismida tanlash, keyin testda tekshirish
//
// Bazaga hech narsa yozmaydi.
import { createClient } from '@supabase/supabase-js';
import { collectEvents, summarize, type BacktestEvent } from '../src/lib/backtest';
import { loadCandles } from '../src/lib/candles';
import { ALGO_VERSION, DEFAULT_PARAMS, type AlgoParams } from '../src/lib/zones';

const WARMUP = 250; // ~1 yil: ATR, swinglar va birinchi zonalar shakllanishi uchun
const TRAIN_SHARE = 0.7;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const candles = await loadCandles(supabase, 'XAU/USD', 'Daily');
const split = Math.floor(candles.length * TRAIN_SHARE);
const date = (i: number) => candles[i].timestamp.slice(0, 10);

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');

function run(params: AlgoParams, from: number, to: number, label: string): BacktestEvent[] {
  const started = performance.now();
  const events = collectEvents(candles, params, {
    from,
    to,
    onProgress: (t) => {
      if ((t - from) % 250 === 0) process.stdout.write(`\r  ${label}: ${date(t)} (${Math.round(((t - from) / (to - from)) * 100)}%)   `);
    },
  });
  process.stdout.write(`\r  ${label}: ${events.length} hodisa, ${((performance.now() - started) / 1000).toFixed(0)} s          \n`);
  return events;
}

function row(events: BacktestEvent[]) {
  const { real, control, edge, z } = summarize(events);
  return {
    hodisa: real.events,
    muvaffaqiyat: pct(real.successRate),
    'nazorat hodisa': control.events,
    'nazorat muvaff.': pct(control.successRate),
    'farq (edge)': Number.isFinite(edge) ? `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)} pp` : '—',
    z: z.toFixed(2),
    buzilish: pct(real.failRate),
    'nazorat buzilish': pct(control.failRate),
    "o'rt. reaksiya": Number.isFinite(real.avgReactionAtr) ? real.avgReactionAtr.toFixed(2) : '—',
  };
}

function report(title: string, events: BacktestEvent[]) {
  const groups: Record<string, BacktestEvent[]> = { HAMMASI: events };
  for (const kind of ['sr', 'demand', 'supply', 'super']) groups[`tur: ${kind}`] = events.filter((e) => e.kind === kind);
  for (const [name, lo, hi] of [['ball 0–30', 0, 30], ['ball 30–60', 30, 60], ['ball 60–100', 60, 101]] as const) {
    groups[name] = events.filter((e) => e.score >= lo && e.score < hi);
  }
  console.log(`\n${title}`);
  console.table(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, row(v)])));
}

console.log(`Backtest, algoritm v${ALGO_VERSION}: ${candles.length} sham`);
console.log(`  train: ${date(WARMUP)} → ${date(split - 1)}   test: ${date(split)} → ${date(candles.length - 1)}`);
console.log(`  Muvaffaqiyat: zonaga kirgach ${DEFAULT_PARAMS.reaction.windowCandles} kun ichida buzilishdan oldin ≥${DEFAULT_PARAMS.reaction.bounceMinAtr} ATR qaytish`);
console.log('  Nazorat: har zonaning ±1..4 ATR ga tasodifiy siljitilgan 5 ta "soya" nusxasi (kenglik va muddat bir xil)');

if (!process.argv.includes('--sweep')) {
  const events = run(DEFAULT_PARAMS, WARMUP, candles.length - 1, 'hisoblanmoqda');
  report('TRAIN (70%)', events.filter((e) => e.index < split));
  report('TEST (30%, hech qachon sozlashda ishlatilmagan)', events.filter((e) => e.index >= split));
} else {
  // Kichik to'r — ko'p kombinatsiya train'ga "moslashib qolish" (overfitting) xavfini oshiradi
  const grid: { name: string; params: AlgoParams }[] = [];
  for (const swingN of [3, 5])
    for (const bufferAtr of [0.1, 0.25])
      for (const impulseMinBodyAtr of [1.5, 2]) {
        grid.push({
          name: `N=${swingN} bufer=${bufferAtr} impuls=${impulseMinBodyAtr}`,
          params: {
            ...DEFAULT_PARAMS,
            swingN,
            sr: { ...DEFAULT_PARAMS.sr, bufferAtr },
            sd: { ...DEFAULT_PARAMS.sd, impulseMinBodyAtr },
          },
        });
      }

  console.log(`\nTRAIN'da ${grid.length} ta kombinatsiya:`);
  const results = grid.map((g) => ({ ...g, summary: summarize(run(g.params, WARMUP, split - 1, g.name)) }));
  console.table(
    Object.fromEntries(
      results.map((r) => [
        r.name,
        {
          hodisa: r.summary.real.events,
          muvaffaqiyat: pct(r.summary.real.successRate),
          nazorat: pct(r.summary.control.successRate),
          'farq (edge)': `${(r.summary.edge * 100).toFixed(1)} pp`,
          z: r.summary.z.toFixed(2),
        },
      ]),
    ),
  );

  // Tanlov mezoni — z: kichik tanlovdagi tasodifiy yuqori foizga aldanmaslik uchun
  const best = results.reduce((a, b) => (b.summary.z > a.summary.z ? b : a));
  console.log(`\nTrain bo'yicha eng yaxshisi: ${best.name}`);
  console.log('Endi TEST qismida (bir marta) tekshiriladi:');
  const testBest = run(best.params, split, candles.length - 1, best.name);
  const testDefault = run(DEFAULT_PARAMS, split, candles.length - 1, 'joriy parametrlar');
  report(`TEST — tanlangan (${best.name})`, testBest);
  report('TEST — joriy parametrlar (solishtirish uchun)', testDefault);
}
