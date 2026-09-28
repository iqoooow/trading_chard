import { createClient } from '@supabase/supabase-js';
import { loadCandles } from './candles';
import { SYMBOL, TIMEFRAME } from './pipeline/syncCandles';
import { DEFAULT_PARAMS, type ZoneKind, type ZoneStatus } from './zones';
import { computeAtr } from './zones/atr';

export const CHART_DAYS = 1000; // ~4 yil — grafikda ko'rsatiladigan shamlar

// [sana, open, high, low, close] — ixcham, client'ga yuboriladi
export type ChartCandle = [string, number, number, number, number];

export type ChartZone = {
  kind: ZoneKind;
  top: number;
  bottom: number;
  from: number; // zona ma'lum bo'lgan sham (candles massividagi indeks)
  to: number; // bekor bo'lgan sham yoki oxirgi sham
  status: ZoneStatus;
  tests: number;
  formedAt: string;
  invalidatedAt: string | null;
};

export type ChartData = {
  candles: ChartCandle[];
  zones: ChartZone[];
  atr: number;
  run: { algoVersion: string; completedAt: string } | null;
};

const day = (timestamp: string) => timestamp.slice(0, 10);

export async function getChartData(): Promise<ChartData> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  const all = await loadCandles(supabase, SYMBOL, TIMEFRAME);
  const atr = computeAtr(all, DEFAULT_PARAMS.atrPeriod).at(-1) ?? 0;
  const window = all.slice(-CHART_DAYS);
  const candles: ChartCandle[] = window.map((c) => [day(c.timestamp), c.open, c.high, c.low, c.close]);
  if (window.length === 0) return { candles, zones: [], atr, run: null };

  const { data: run, error: runError } = await supabase
    .from('analysis_runs')
    .select('id, algo_version, completed_at')
    .eq('symbol', SYMBOL)
    .eq('timeframe', TIMEFRAME)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return { candles, zones: [], atr, run: null };

  // Faqat grafik oynasiga tegishli zonalar: tirik yoki oyna ichida bekor bo'lganlar
  const windowStart = window[0].timestamp;
  const { data: rows, error: zonesError } = await supabase
    .from('zones')
    .select('kind, top_price, bottom_price, formed_at, confirmed_at, status, invalidated_at, test_count')
    .eq('run_id', run.id)
    .or(`status.neq.invalid,invalidated_at.gte.${windowStart}`);
  if (zonesError) throw zonesError;

  const indexByDay = new Map(candles.map((c, i) => [c[0], i]));
  const indexOf = (timestamp: string) => indexByDay.get(day(timestamp)) ?? (timestamp < windowStart ? 0 : null);
  const last = candles.length - 1;

  const zones: ChartZone[] = [];
  for (const z of rows) {
    const from = indexOf(z.confirmed_at);
    const to = z.invalidated_at ? indexOf(z.invalidated_at) : last;
    if (from === null || to === null) continue;
    zones.push({
      kind: z.kind,
      top: Number(z.top_price),
      bottom: Number(z.bottom_price),
      from,
      to,
      status: z.status,
      tests: z.test_count,
      formedAt: day(z.formed_at),
      invalidatedAt: z.invalidated_at ? day(z.invalidated_at) : null,
    });
  }

  return { candles, zones, atr, run: { algoVersion: run.algo_version, completedAt: run.completed_at } };
}
