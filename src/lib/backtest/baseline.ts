import type { ZoneKind } from '../zones';

// Takrorlanadigan tasodifiy sonlar (seed bilan) — backtest natijasi har safar bir xil
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_CODE: Record<ZoneKind, number> = { sr: 1, supply: 2, demand: 3, super: 4 };

export const SHADOW_MIN_ATR = 1;
export const SHADOW_MAX_ATR = 4;

// Nazorat guruhi — "soya" zona: haqiqiy zonaning ±1..4 ATR ga tasodifiy siljitilgan nusxasi.
// Kengligi va yashash muddati bir xil, faqat narx darajasi tasodifiy. Siljish zona uchun
// barqaror (har kuni bir xil), shuning uchun soyaga narx boshqa kunlarda, mustaqil kiradi.
export function shadowOffset(
  zone: { kind: ZoneKind; formedIndex: number; atrAtFormation: number },
  k: number,
  seed: number,
): number {
  const rand = mulberry32(
    (Math.imul(seed, 73856093) ^ Math.imul(zone.formedIndex + 1, 19349663) ^ Math.imul(KIND_CODE[zone.kind], 83492791) ^ Math.imul(k + 1, 2654435761)) >>> 0,
  );
  const sign = rand() < 0.5 ? -1 : 1;
  const magnitude = SHADOW_MIN_ATR + rand() * (SHADOW_MAX_ATR - SHADOW_MIN_ATR);
  return sign * magnitude * zone.atrAtFormation;
}
