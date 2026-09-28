import type { SupabaseClient } from '@supabase/supabase-js';

// TwelveData time_series javobidagi bitta sham
type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

type TwelveDataResponse = {
  status?: string;
  message?: string;
  values?: TwelveDataCandle[];
};

export const SYMBOL = 'XAU/USD';
export const TIMEFRAME = 'Daily';
const INTERVAL = '1day';
export const DEFAULT_OUTPUT_SIZE = 30; // Kunlik yangilash uchun yetarli (bo'shliqlarni ham qoplaydi)
export const MAX_OUTPUT_SIZE = 5000; // TwelveData limiti, ~18 yillik kunlik tarix (backfill uchun)

// Oltin dam olish kunlari savdo qilinmaydi — TwelveData 2024 oxiridan beri shanba/yakshanba
// uchun soxta (deyarli tekis) shamlar qaytaradi, ular ATR va swing hisobini buzadi
function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export type FetchedCandle = { timestamp: string; open: number; high: number; low: number; close: number };

// TwelveData'dan oxirgi outputSize ta kunlik shamni oladi — faqat yopilgan ish kunlari,
// xronologik tartibda
export async function fetchDailyCandles(apiKey: string, symbol: string, outputSize: number): Promise<FetchedCandle[]> {
  const params = new URLSearchParams({
    symbol,
    interval: INTERVAL,
    outputsize: String(Math.min(Math.max(1, outputSize), MAX_OUTPUT_SIZE)),
    timezone: 'UTC', // Kunlik sham chegarasi — UTC 00:00
    apikey: apiKey,
  });
  const response = await fetch(`https://api.twelvedata.com/time_series?${params}`);
  const data: TwelveDataResponse = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(`TwelveData xatosi: ${data.message ?? response.status}`);
  }
  if (!data.values || data.values.length === 0) {
    throw new Error('TwelveData dan shamlar kelmadi');
  }

  // Bugungi sham hali yopilmagan — u ertangi sinxronlashda to'liq holda yoziladi
  const todayUtc = new Date().toISOString().slice(0, 10);

  // TwelveData eng yangisidan boshlab beradi, xronologik tartibga solamiz
  return [...data.values]
    .reverse()
    .filter((candle) => candle.datetime < todayUtc && !isWeekend(candle.datetime))
    .map((candle) => ({
      timestamp: new Date(`${candle.datetime}T00:00:00Z`).toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }));
}

// Oxirgi outputSize ta kunlik shamni bazaga upsert qiladi. Qaytaradi: yozilgan shamlar soni.
export async function syncCandles(supabase: SupabaseClient, apiKey: string, outputSize: number): Promise<number> {
  const candles = (await fetchDailyCandles(apiKey, SYMBOL, outputSize)).map((c) => ({
    ...c,
    symbol: SYMBOL,
    timeframe: TIMEFRAME,
  }));

  const { error } = await supabase.from('candles').upsert(candles, { onConflict: 'symbol,timeframe,timestamp' });
  if (error) throw new Error(`Shamlarni yozishda xatolik: ${error.message}`);
  return candles.length;
}
