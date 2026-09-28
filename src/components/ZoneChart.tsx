'use client';

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  TickMarkType,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartCandle, ChartZone } from '@/lib/chartData';
import type { ZoneKind } from '@/lib/zones';
import { ZonesPrimitive } from './zonesPrimitive';
import { dateParts, findZoneAt, formatDate, monthName, STATUS_LABELS, ZONE_COLORS, ZONE_LABELS } from './zoneStyle';

const KINDS: ZoneKind[] = ['sr', 'demand', 'supply', 'super'];
const INITIAL_BARS = 180;

const THEMES = {
  light: { text: '#52525b', grid: '#f4f4f5', border: '#e4e4e7' },
  dark: { text: '#a1a1aa', grid: '#18181b', border: '#27272a' },
};

type Props = { candles: ChartCandle[]; zones: ChartZone[] };

export default function ZoneChart({ candles, zones }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const primitiveRef = useRef<ZonesPrimitive | null>(null);

  const [kinds, setKinds] = useState<Set<ZoneKind>>(() => new Set(KINDS));
  const [showInvalid, setShowInvalid] = useState(false);
  const [hovered, setHovered] = useState<ChartZone | null>(null);

  const visibleZones = useMemo(
    () => zones.filter((z) => kinds.has(z.kind) && (showInvalid || z.status !== 'invalid')),
    [zones, kinds, showInvalid],
  );

  // Grafik bir marta yaratiladi
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, fontSize: 12 },
      localization: { locale: 'en-US', timeFormatter: formatDate },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const { year, month, day } = dateParts(time);
          if (type === TickMarkType.Year) return String(year);
          if (type === TickMarkType.Month) return monthName(month);
          return `${day} ${monthName(month)}`;
        },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
    });
    series.setData(candles.map(([time, open, high, low, close]) => ({ time: time as Time, open, high, low, close })));

    const primitive = new ZonesPrimitive();
    series.attachPrimitive(primitive);
    chart.timeScale().setVisibleLogicalRange({ from: candles.length - INITIAL_BARS, to: candles.length + 3 });

    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const t = dark.matches ? THEMES.dark : THEMES.light;
      chart.applyOptions({
        layout: { textColor: t.text },
        grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
        crosshair: { vertLine: { labelBackgroundColor: t.border }, horzLine: { labelBackgroundColor: t.border } },
      });
    };
    applyTheme();
    dark.addEventListener('change', applyTheme);

    chartRef.current = chart;
    seriesRef.current = series;
    primitiveRef.current = primitive;
    return () => {
      dark.removeEventListener('change', applyTheme);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      primitiveRef.current = null;
    };
  }, [candles]);

  // Filtr o'zgarganda zonalarni qayta chizish
  useEffect(() => {
    primitiveRef.current?.setZones(
      visibleZones.map((z) => ({
        from: z.from,
        to: z.to,
        top: z.top,
        bottom: z.bottom,
        color: ZONE_COLORS[z.kind],
        faded: z.status === 'invalid',
      })),
    );
  }, [visibleZones, candles]);

  // Kursor ostidagi zona haqida ma'lumot
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const onMove = (param: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
      if (!param.point || param.logical === undefined) return setHovered(null);
      const price = series.coordinateToPrice(param.point.y);
      if (price === null) return setHovered(null);
      setHovered(findZoneAt(visibleZones, Math.round(param.logical), price));
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
  }, [visibleZones, candles]);

  const toggleKind = (kind: ZoneKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {KINDS.map((kind) => (
          <label key={kind} className="flex cursor-pointer items-center gap-2 select-none">
            <input type="checkbox" checked={kinds.has(kind)} onChange={() => toggleKind(kind)} />
            <span className="inline-block h-3 w-4 rounded-sm" style={{ background: ZONE_COLORS[kind], opacity: 0.6 }} />
            {ZONE_LABELS[kind]}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2 text-zinc-500 select-none">
          <input type="checkbox" checked={showInvalid} onChange={(e) => setShowInvalid(e.target.checked)} />
          Bekor bo&apos;lgan zonalarni ko&apos;rsatish
        </label>
      </div>

      <div ref={containerRef} className="h-[480px] w-full" />

      <p className="mt-2 min-h-5 text-sm text-zinc-500">
        {hovered
          ? `${ZONE_LABELS[hovered.kind]}: ${hovered.bottom.toFixed(1)} – ${hovered.top.toFixed(1)} · ${STATUS_LABELS[hovered.status]}` +
            ` · shakllangan ${hovered.formedAt} · ${hovered.tests} marta test qilingan` +
            (hovered.invalidatedAt ? ` · bekor bo'lgan ${hovered.invalidatedAt}` : '')
          : 'Zona haqida ma\'lumot olish uchun kursorni uning ustiga olib boring.'}
      </p>
    </div>
  );
}
