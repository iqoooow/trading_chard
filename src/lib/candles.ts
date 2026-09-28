import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candle } from './zones';

const PAGE_SIZE = 1000; // PostgREST bir so'rovda ko'pi bilan shuncha qator qaytaradi

// Barcha shamlarni xronologik tartibda sahifalab yuklaydi
export async function loadCandles(supabase: SupabaseClient, symbol: string, timeframe: string): Promise<Candle[]> {
  const candles: Candle[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('candles')
      .select('id, timestamp, open, high, low, close')
      .eq('symbol', symbol)
      .eq('timeframe', timeframe)
      .order('timestamp')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    for (const row of data) {
      candles.push({
        id: row.id,
        timestamp: row.timestamp,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
      });
    }
    if (data.length < PAGE_SIZE) return candles;
  }
}
