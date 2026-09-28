import ZoneChart from '@/components/ZoneChart';
import { STATUS_LABELS, ZONE_COLORS, ZONE_LABELS } from '@/components/zoneStyle';
import { getChartData } from '@/lib/chartData';

// Ma'lumot kuniga bir marta yangilanadi; cron tugagach revalidatePath('/') darhol yangilaydi
export const revalidate = 3600;

const NEAR_ATR = 5; // Jadvalda joriy narxdan shuncha ATR ichidagi zonalar

export default async function Home() {
  const { candles, zones, atr, run } = await getChartData();
  const last = candles.at(-1);

  if (!last) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p>Hali ma&apos;lumot yo&apos;q.</p>
      </main>
    );
  }

  const close = last[4];
  const nearby = zones
    .filter((z) => z.status !== 'invalid' && Math.abs((z.top + z.bottom) / 2 - close) <= NEAR_ATR * atr)
    .sort((a, b) => b.top - a.top);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">XAU/USD — zonalar tahlili</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Oltin, kunlik grafik · oxirgi sham {last[0]} · yopilish {close.toFixed(2)} · ATR(14) {atr.toFixed(1)}
          {run && ` · algoritm v${run.algoVersion}`}
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
        Bu savdo signali yoki investitsiya maslahati emas. Zonalar — narx o&apos;tmishda reaksiya qilgan darajalar.
        Tarixiy sinov (2009–2026) ularning tasodifiy narx darajalaridan yaxshiroq ishlashini ko&apos;rsatmadi, shuning
        uchun ular faqat vizual mo&apos;ljal sifatida ko&apos;rsatiladi.
      </div>

      <ZoneChart candles={candles} zones={zones} />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Joriy narx atrofidagi zonalar (±{NEAR_ATR} ATR)</h2>
        {nearby.length === 0 ? (
          <p className="text-sm text-zinc-500">Joriy narx yaqinida faol zona yo&apos;q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="py-2 pr-4 font-medium">Turi</th>
                  <th className="py-2 pr-4 font-medium">Oraliq</th>
                  <th className="py-2 pr-4 font-medium">Narxga nisbatan</th>
                  <th className="py-2 pr-4 font-medium">Holati</th>
                  <th className="py-2 pr-4 font-medium">Shakllangan</th>
                  <th className="py-2 font-medium">Testlar</th>
                </tr>
              </thead>
              <tbody>
                {nearby.map((z) => {
                  const distance = ((z.top + z.bottom) / 2 - close) / atr;
                  const inside = close >= z.bottom && close <= z.top;
                  return (
                    <tr key={`${z.kind}-${z.formedAt}-${z.bottom}`} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-4">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ZONE_COLORS[z.kind] }} />
                        {ZONE_LABELS[z.kind]}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {z.bottom.toFixed(1)} – {z.top.toFixed(1)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {inside
                          ? 'narx zona ichida'
                          : `${Math.abs(distance).toFixed(1)} ATR ${distance > 0 ? 'yuqorida' : 'pastda'}`}
                      </td>
                      <td className="py-2 pr-4">{STATUS_LABELS[z.status]}</td>
                      <td className="py-2 pr-4 tabular-nums">{z.formedAt}</td>
                      <td className="py-2 tabular-nums">{z.tests}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-500 dark:border-zinc-800">
        Ma&apos;lumot manbasi: TwelveData (XAU/USD, kunlik, UTC). Zonalar har kuni avtomatik qayta hisoblanadi.
        {run && ` Oxirgi hisoblash: ${run.completedAt.slice(0, 16).replace('T', ' ')} UTC.`}
      </footer>
    </main>
  );
}
