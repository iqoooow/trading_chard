// research/HYPOTHESES.md dagi gipotezalarni aynan o'sha qoidalar bo'yicha tekshiradi va
// natijani research/RESULTS.md ga yozadi. Bazaga hech narsa yozmaydi.
//   npm run research            — gipotezalar (RESULTS.md)
//   npm run research -- --null  — metodika nazorati tasodifiy bozorda (NULL_CHECKS.md)
// USD/JPY va EUR/USD bir marta TwelveData'dan yuklanib research/data/ ga keshlanadi.
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { collectEvents, createProviders, mulberry32, summarize, type BacktestEvent, type Summary } from '../src/lib/backtest';
import { loadCandles } from '../src/lib/candles';
import { fetchDailyCandles } from '../src/lib/pipeline/syncCandles';
import { ALGO_VERSION, DEFAULT_PARAMS, type AlgoParams, type Candle } from '../src/lib/zones';

const WARMUP = 250;
const TRAIN_SHARE = 0.7;
const Z_DISCOVERY = 2.58; // Bonferroni: 5 ta test, umumiy α = 0.05
const Z_CONFIRM = 1.96;
const MIN_EVENTS = 100;

type HypothesisId = 'H1' | 'H2' | 'H3' | 'H4a' | 'H4b';
const HYPOTHESES: { id: HypothesisId; title: string; metric: 'success' | 'fail' }[] = [
  { id: 'H1', title: '≥2 touch li zonalar', metric: 'success' },
  { id: 'H2', title: 'Haftalik zonalar', metric: 'success' },
  { id: 'H3', title: 'Breakout (buzilish ko\'proq)', metric: 'fail' },
  { id: 'H4a', title: 'Oyna 10 kun, ≥1.5 ATR', metric: 'success' },
  { id: 'H4b', title: 'Oyna 20 kun, ≥2 ATR', metric: 'success' },
];

const withReaction = (windowCandles: number, bounceMinAtr: number): AlgoParams => ({
  ...DEFAULT_PARAMS,
  reaction: { windowCandles, bounceMinAtr },
});

// ---------- ma'lumotlar ----------

async function cachedTwelveData(symbol: string): Promise<Candle[]> {
  const file = `research/data/${symbol.replace('/', '')}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const candles = await fetchDailyCandles(process.env.TWELVEDATA_API_KEY!, symbol, 5000);
  mkdirSync('research/data', { recursive: true });
  writeFileSync(file, JSON.stringify(candles));
  return candles;
}

// OHLC mantiqan buzilgan shamlar (high < close va h.k.) chiqarib tashlanadi va hisobotda aytiladi
function clean(candles: Candle[]) {
  const ok = candles.filter(
    (c) => c.low > 0 && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close),
  );
  return { candles: ok, dropped: candles.length - ok.length };
}

// ---------- baholash ----------

function evaluate(label: string, candles: Candle[], from: number, to: number): Record<HypothesisId, Summary> {
  const started = performance.now();
  const { daily, weekly } = createProviders(candles, DEFAULT_PARAMS);
  const run = (params: AlgoParams, provider = daily, progress = false): BacktestEvent[] =>
    collectEvents(candles, params, {
      from,
      to,
      provider,
      onProgress: progress
        ? (t) => {
            if ((t - from) % 300 === 0) process.stdout.write(`\r  ${label}: ${Math.round(((t - from) / (to - from)) * 100)}%   `);
          }
        : undefined,
    });

  const base = run(DEFAULT_PARAMS, daily, true);
  const result: Record<HypothesisId, Summary> = {
    H1: summarize(base.filter((e) => e.touches >= 2)),
    H2: summarize(run(DEFAULT_PARAMS, weekly)),
    H3: summarize(base),
    H4a: summarize(run(withReaction(10, 1.5))),
    H4b: summarize(run(withReaction(20, 2))),
  };
  process.stdout.write(`\r  ${label}: tayyor (${((performance.now() - started) / 1000).toFixed(0)} s)          \n`);
  return result;
}

const pick = (s: Summary, metric: 'success' | 'fail') =>
  metric === 'success'
    ? { real: s.real.successRate, control: s.control.successRate, edge: s.edge, z: s.z }
    : { real: s.real.failRate, control: s.control.failRate, edge: s.failEdge, z: s.failZ };

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');
const pp = (x: number) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp` : '—');

// ---------- metodika nazorati (npm run research -- --null) ----------
// Xotirasiz tasodifiy bozorda hech qanday haqiqiy ta'sir yo'q — u yerda H3 metrikasi 0 atrofida
// bo'lishi kerak. Aks holda "breakout" metodikaning o'zidan kelib chiqqan bo'lardi.

function syntheticWalk(n: number, seed: number, regimes: boolean): Candle[] {
  const r = mulberry32(seed);
  const start = Date.UTC(2008, 0, 7); // dushanba
  const out: Candle[] = [];
  let price = 1000;
  let vol = 8;
  for (let day = 0; out.length < n; day++) {
    const d = new Date(start + day * 864e5);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    if (regimes && r() < 0.02) vol = vol === 8 ? 30 : 8; // tinch <-> notinch davrlar
    const g = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    const open = price;
    const close = Math.max(50, open + g * vol);
    out.push({ timestamp: d.toISOString(), open, high: Math.max(open, close) + r() * vol * 0.6, low: Math.min(open, close) - r() * vol * 0.6, close });
    price = close;
  }
  return out;
}

if (process.argv.includes('--null')) {
  const rows = ['| Bozor modeli | Seed | Hodisa | Zona buzilishi | Soya buzilishi | Farq | z |', '|---|---|---|---|---|---|---|'];
  for (const regimes of [false, true]) {
    for (const seed of [3, 11, 19, 27, 35]) {
      const s = summarize(collectEvents(syntheticWalk(4600, seed, regimes), DEFAULT_PARAMS, { from: WARMUP }));
      const row = `| ${regimes ? 'Volatillik rejimlari bilan' : 'Oddiy random walk'} | ${seed} | ${s.real.events} | ${pct(s.real.failRate)} | ${pct(s.control.failRate)} | ${pp(s.failEdge)} | ${s.failZ.toFixed(2)} |`;
      rows.push(row);
      console.log(row);
    }
  }
  writeFileSync(
    'research/NULL_CHECKS.md',
    [
      '# Metodika nazorati: tasodifiy bozorda H3 (breakout) metrikasi',
      '',
      'Xotirasiz sintetik bozorlarda haqiqiy ta\'sir yo\'q, shuning uchun "zona soyadan ko\'proq buziladi"',
      'farqi 0 atrofida bo\'lishi kerak. Haqiqiy natijalar bilan solishtirish: [RESULTS.md](RESULTS.md).',
      '',
      ...rows,
      '',
    ].join('\n'),
  );
  console.log('Natija: research/NULL_CHECKS.md');
  process.exit(0);
}

// ---------- ishga tushirish ----------

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const gold = await loadCandles(supabase, 'XAU/USD', 'Daily');
const yen = clean(await cachedTwelveData('USD/JPY'));
const euro = clean(await cachedTwelveData('EUR/USD'));
const split = Math.floor(gold.length * TRAIN_SHARE);
const day = (c: Candle[], i: number) => c[i].timestamp.slice(0, 10);

const datasets = [
  { key: 'goldTrain', name: 'XAU/USD train (kashfiyot)', candles: gold, from: WARMUP, to: split - 1 },
  { key: 'yen', name: 'USD/JPY (tasdiqlash)', candles: yen.candles, from: WARMUP, to: yen.candles.length - 1 },
  { key: 'euro', name: 'EUR/USD (tasdiqlash)', candles: euro.candles, from: WARMUP, to: euro.candles.length - 1 },
  { key: 'goldTest', name: 'XAU/USD test (faqat ma\'lumot)', candles: gold, from: split, to: gold.length - 1 },
] as const;

console.log(`Tadqiqot, algoritm v${ALGO_VERSION}`);
for (const d of datasets) {
  console.log(`  ${d.name}: ${day(d.candles, d.from)} → ${day(d.candles, d.to)} (${d.to - d.from + 1} kun)`);
}
if (yen.dropped || euro.dropped) console.log(`  OHLC xato shamlar chiqarildi: JPY ${yen.dropped}, EUR ${euro.dropped}`);

const results = Object.fromEntries(datasets.map((d) => [d.key, evaluate(d.name, d.candles, d.from, d.to)])) as Record<
  (typeof datasets)[number]['key'],
  Record<HypothesisId, Summary>
>;

// ---------- qaror (HYPOTHESES.md qoidalari) ----------

function verdict(id: HypothesisId, metric: 'success' | 'fail') {
  const train = results.goldTrain[id];
  const t = pick(train, metric);
  // H3 g'oyasi XAU/USD dan olingan — kashfiyot bosqichi uning uchun hisobga olinmaydi
  const discovered = id === 'H3' || (t.z >= Z_DISCOVERY && train.real.events >= MIN_EVENTS);
  if (!discovered) return { discovered: false, verdict: 'rad etildi (kashfiyotdan o\'tmadi)' };
  const confirmed = (['yen', 'euro'] as const).every((k) => pick(results[k][id], metric).z >= Z_CONFIRM);
  return { discovered: true, verdict: confirmed ? 'TASDIQLANDI' : 'rad etildi (tasdiqlanmadi)' };
}

const lines: string[] = [
  '# Tadqiqot natijalari',
  '',
  `Algoritm v${ALGO_VERSION} · Qoidalar: [HYPOTHESES.md](HYPOTHESES.md) · Yaratildi: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  '',
  '## Ma\'lumotlar',
  '',
  ...datasets.map((d) => `- ${d.name}: ${day(d.candles, d.from)} → ${day(d.candles, d.to)}`),
  '',
  '## Xulosa',
  '',
  '| # | Gipoteza | Kashfiyot (XAU train) | USD/JPY | EUR/USD | Qaror |',
  '|---|---|---|---|---|---|',
];

for (const h of HYPOTHESES) {
  const cell = (k: keyof typeof results) => {
    const s = results[k][h.id];
    const m = pick(s, h.metric);
    return `${pp(m.edge)}, z=${m.z.toFixed(2)} (n=${s.real.events})`;
  };
  lines.push(`| ${h.id} | ${h.title} | ${cell('goldTrain')} | ${cell('yen')} | ${cell('euro')} | ${verdict(h.id, h.metric).verdict} |`);
}

lines.push('', '## Batafsil', '');
for (const h of HYPOTHESES) {
  lines.push(`### ${h.id}: ${h.title} (${h.metric === 'success' ? 'muvaffaqiyat' : 'buzilish'} ulushi)`, '');
  lines.push('| Ma\'lumot | Hodisa | Zona | Soya (nazorat) | Farq | z |', '|---|---|---|---|---|---|');
  for (const d of datasets) {
    const s = results[d.key][h.id];
    const m = pick(s, h.metric);
    lines.push(`| ${d.name} | ${s.real.events} | ${pct(m.real)} | ${pct(m.control)} | ${pp(m.edge)} | ${m.z.toFixed(2)} |`);
  }
  lines.push('');
}

writeFileSync('research/RESULTS.md', lines.join('\n'));
console.log('\n' + lines.slice(lines.indexOf('## Xulosa'), lines.indexOf('## Batafsil')).join('\n'));
console.log('To\'liq natija: research/RESULTS.md');
