import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/pipeline/runAnalysis';
import { DEFAULT_OUTPUT_SIZE, SYMBOL, syncCandles, TIMEFRAME } from '@/lib/pipeline/syncCandles';
import { createAdminClient } from '@/utils/supabase/admin';

export const maxDuration = 60;

// Kunlik jarayon: yangi shamlar → zonalarni qayta hisoblash → bosh sahifani yangilash.
//   GET /api/cron/daily                  — oxirgi 30 kun (kunlik cron)
//   GET /api/cron/daily?outputsize=5000  — to'liq tarixni qayta yuklash (backfill)
// CRON_SECRET berilgan bo'lsa, "Authorization: Bearer <CRON_SECRET>" talab qilinadi
// (Vercel Cron uni avtomatik yuboradi).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TWELVEDATA_API_KEY topilmadi' }, { status: 500 });
  }

  const requested = Number(new URL(request.url).searchParams.get('outputsize'));
  const outputSize = requested > 0 ? requested : DEFAULT_OUTPUT_SIZE;

  try {
    const supabase = createAdminClient();
    const synced = await syncCandles(supabase, apiKey, outputSize);
    const analysis = await runAnalysis(supabase, SYMBOL, TIMEFRAME);
    revalidatePath('/');
    return NextResponse.json({ success: true, synced, analysis });
  } catch (error) {
    console.error('Kunlik jarayonda xatolik:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
