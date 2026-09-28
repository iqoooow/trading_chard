import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

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

const SYMBOL = 'XAU/USD';
const INTERVAL = '1day';
const TIMEFRAME = 'Daily';
const DEFAULT_OUTPUT_SIZE = 30; // Kunlik yangilash uchun yetarli (bo'shliqlarni ham qoplaydi)
const MAX_OUTPUT_SIZE = 5000; // TwelveData limiti, ~18 yillik kunlik tarix (backfill uchun)

// Oltin dam olish kunlari savdo qilinmaydi — TwelveData 2024 oxiridan beri shanba/yakshanba
// uchun soxta (deyarli tekis) shamlar qaytaradi, ular ATR va swing hisobini buzadi
function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export async function GET(request: Request) {
  try {
    // Endpoint bazaga yozadi va API limitini sarflaydi, shuning uchun CRON_SECRET bilan himoyalaymiz
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TWELVEDATA_API_KEY topilmadi' }, { status: 500 });
    }

    // ?outputsize=5000 — to'liq tarixni bir marta yuklash (backfill) uchun
    const requested = Number(new URL(request.url).searchParams.get('outputsize'));
    const outputSize = requested > 0 ? Math.min(requested, MAX_OUTPUT_SIZE) : DEFAULT_OUTPUT_SIZE;

    const params = new URLSearchParams({
      symbol: SYMBOL,
      interval: INTERVAL,
      outputsize: String(outputSize),
      timezone: 'UTC', // Kunlik sham chegarasi — UTC 00:00
      apikey: apiKey,
    });
    const response = await fetch(`https://api.twelvedata.com/time_series?${params}`);
    const data: TwelveDataResponse = await response.json();

    if (!response.ok || data.status === 'error') {
      return NextResponse.json({ error: data.message ?? 'TwelveData xatosi' }, { status: 502 });
    }

    if (!data.values || data.values.length === 0) {
      return NextResponse.json({ error: 'TwelveData dan shamlar kelmadi' }, { status: 404 });
    }

    // Bugungi sham hali yopilmagan — u ertangi sinxronlashda to'liq holda yoziladi
    const todayUtc = new Date().toISOString().slice(0, 10);

    // TwelveData eng yangisidan boshlab beradi, xronologik tartibga solamiz
    const candles = [...data.values]
      .reverse()
      .filter((candle) => candle.datetime < todayUtc && !isWeekend(candle.datetime))
      .map((candle) => ({
        symbol: SYMBOL,
        timeframe: TIMEFRAME,
        timestamp: new Date(`${candle.datetime}T00:00:00Z`).toISOString(),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
      }));

    // RLS anon uchun faqat o'qishga ruxsat beradi, shuning uchun yozish admin client orqali
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('candles')
      .upsert(candles, { onConflict: 'symbol,timeframe,timestamp' });

    if (error) {
      console.error('Supabase upsert xatosi:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${candles.length} ta sham bazaga yozildi/yangilandi`,
    });
  } catch (error) {
    console.error('Shamlarni sinxronlashda xatolik:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
