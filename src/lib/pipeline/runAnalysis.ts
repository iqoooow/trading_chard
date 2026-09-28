import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCandles } from '../candles';
import { ALGO_VERSION, analyze, DEFAULT_PARAMS, type AlgoParams } from '../zones';

const CHUNK = 500; // Bitta insert so'rovidagi qatorlar soni
const KEEP_RUNS = 3; // Oxirgi nechta hisoblash saqlanadi (solishtirish uchun)

const round = (x: number, digits = 4) => Number(x.toFixed(digits));

async function insertChunked(supabase: SupabaseClient, table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table} ga yozishda xatolik: ${error.message}`);
  }
}

export type AnalysisSummary = {
  runId: string;
  candles: number;
  swings: number;
  zones: number;
  liveZones: number;
  tests: number;
};

// Bazadagi barcha shamlar ustida algoritmni ishga tushirib, natijani yangi analysis_run
// sifatida yozadi. Run avval 'running', hammasi yozilgach 'completed' bo'ladi — sayt faqat
// 'completed' run'ni o'qiydi, shuning uchun yarim yozilgan holat hech qachon ko'rinmaydi.
export async function runAnalysis(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: string,
  params: AlgoParams = DEFAULT_PARAMS,
): Promise<AnalysisSummary> {
  const candles = await loadCandles(supabase, symbol, timeframe);
  if (candles.length === 0) throw new Error('Bazada shamlar yo\'q');

  const result = analyze(candles, params);
  const ts = (i: number) => candles[i].timestamp;
  const candleId = (i: number) => {
    const id = candles[i].id;
    if (!id) throw new Error(`Sham id si yo'q: ${ts(i)}`);
    return id;
  };

  const { data: run, error: runError } = await supabase
    .from('analysis_runs')
    .insert({
      symbol,
      timeframe,
      algo_version: ALGO_VERSION,
      params,
      candles_from: ts(0),
      candles_to: ts(candles.length - 1),
    })
    .select('id')
    .single();
  if (runError) throw new Error(`analysis_runs yaratilmadi: ${runError.message}`);

  try {
    await insertChunked(
      supabase,
      'swing_points',
      result.swings.map((s) => ({
        run_id: run.id,
        candle_id: candleId(s.index),
        type: s.type,
        price: s.price,
        occurred_at: ts(s.index),
        confirmed_at: ts(s.confirmedIndex),
      })),
    );

    // Zona id lari oldindan yaratiladi — testlarni zonaga bog'lash uchun insert javobiga tayanmaymiz
    const zones = result.zones.map((z) => ({ id: crypto.randomUUID(), zone: z }));
    await insertChunked(
      supabase,
      'zones',
      zones.map(({ id, zone: z }) => ({
        id,
        run_id: run.id,
        kind: z.kind,
        top_price: z.top,
        bottom_price: z.bottom,
        formed_at: ts(z.formedIndex),
        confirmed_at: ts(z.confirmedIndex),
        atr_at_formation: round(z.atrAtFormation),
        test_count: z.tests.length,
        last_tested_at: z.tests.length ? ts(z.tests[z.tests.length - 1].index) : null,
        status: z.status,
        invalidated_at: z.invalidatedIndex === null ? null : ts(z.invalidatedIndex),
        sr_score: round(z.scores.sr, 2),
        sd_score: round(z.scores.sd, 2),
        tf_score: round(z.scores.tf, 2),
        score: round(z.scores.total, 2),
      })),
    );

    const tests = zones.flatMap(({ id, zone }) =>
      zone.tests.map((t) => ({
        zone_id: id,
        candle_id: candleId(t.index),
        tested_at: ts(t.index),
        reaction_type: t.reactionType,
        reaction_atr: t.reactionAtr === null ? null : round(t.reactionAtr),
      })),
    );
    await insertChunked(supabase, 'zone_tests', tests);

    const { error: doneError } = await supabase
      .from('analysis_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', run.id);
    if (doneError) throw new Error(`Run yakunlanmadi: ${doneError.message}`);

    await pruneOldRuns(supabase, symbol, timeframe);

    return {
      runId: run.id,
      candles: candles.length,
      swings: result.swings.length,
      zones: result.zones.length,
      liveZones: result.zones.filter((z) => z.status !== 'invalid').length,
      tests: tests.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from('analysis_runs').update({ status: 'failed', error: message }).eq('id', run.id);
    throw error;
  }
}

// Eski run'lar o'chiriladi (swing/zona/testlar CASCADE bilan birga)
async function pruneOldRuns(supabase: SupabaseClient, symbol: string, timeframe: string) {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('id')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Eski run'larni o'qishda xatolik: ${error.message}`);

  const stale = data.slice(KEEP_RUNS).map((r) => r.id);
  if (stale.length === 0) return;
  const { error: deleteError } = await supabase.from('analysis_runs').delete().in('id', stale);
  if (deleteError) throw new Error(`Eski run'larni o'chirishda xatolik: ${deleteError.message}`);
}
