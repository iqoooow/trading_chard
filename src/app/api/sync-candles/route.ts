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
const OUTPUT_SIZE = 100; // Oxirgi 100 kunlik ma'lumot

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

    const params = new URLSearchParams({
      symbol: SYMBOL,
      interval: INTERVAL,
      outputsize: String(OUTPUT_SIZE),
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

    // TwelveData eng yangisidan boshlab beradi, xronologik tartibga solamiz
    const candles = [...data.values].reverse().map((candle) => ({
      symbol: SYMBOL,
      timeframe: TIMEFRAME,
      timestamp: new Date(candle.datetime).toISOString(),
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
