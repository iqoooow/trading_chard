import type { ZoneKind, ZoneStatus } from '@/lib/zones';

// Brauzerlarning ko'pida o'zbek tili uchun Intl oy nomlari yo'q, shuning uchun qo'lda
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

type DateParts = { year: number; month: number; day: number };

// Lightweight Charts vaqtini (UTC soniya, BusinessDay yoki 'YYYY-MM-DD') sana qismlariga ajratadi
export function dateParts(time: number | string | DateParts): DateParts {
  if (typeof time === 'object') return time;
  const d = typeof time === 'number' ? new Date(time * 1000) : new Date(`${time}T00:00:00Z`);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export const monthName = (month: number) => MONTHS[month - 1];

export function formatDate(time: number | string | DateParts): string {
  const { year, month, day } = dateParts(time);
  return `${day} ${monthName(month)} ${year}`;
}

type ZoneBox ={ from: number; to: number; top: number; bottom: number };

// Kursor (sham indeksi, narx) ostidagi zona. Ichma-ich zonalarda eng ingichkasi — u aniqrog'i.
export function findZoneAt<T extends ZoneBox>(zones: T[], logical: number, price: number): T | null {
  let best: T | null = null;
  for (const z of zones) {
    if (logical < z.from || logical > z.to || price < z.bottom || price > z.top) continue;
    if (!best || z.top - z.bottom < best.top - best.bottom) best = z;
  }
  return best;
}

export const ZONE_COLORS: Record<ZoneKind, string> = {
  sr: '#7F77DD',
  demand: '#378ADD',
  supply: '#BA7517',
  super: '#D4537E',
};

export const ZONE_LABELS: Record<ZoneKind, string> = {
  sr: 'Support / Resistance',
  demand: 'Demand',
  supply: 'Supply',
  super: 'S/R + S/D mos kelgan',
};

export const STATUS_LABELS: Record<ZoneStatus, string> = {
  active: 'faol',
  stale: 'eskirgan',
  invalid: 'bekor bo\'lgan',
};
