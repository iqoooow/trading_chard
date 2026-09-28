import type { AlgoParams } from './config';
import type { Side, Zone } from './types';
import { isSupplyDemand } from './zone';

// Yopilish zonadan breakCloseAtr × ATR dan uzoqda bo'lsa — narx o'sha tomonda "aniq" turibdi
export function clearSideOf(close: number, zone: Zone, atr: number, breakCloseAtr: number): Side | null {
  if (close > zone.top + breakCloseAtr * atr) return 'above';
  if (close < zone.bottom - breakCloseAtr * atr) return 'below';
  return null;
}

// Narx zonaning bir tomonidan ikkinchi tomoniga aniq yopilish bilan o'tsa — zona bekor.
// Hajm ishlatilmaydi: forexda markazlashgan hajm yo'q. Qaytaradi: shu sham bekor qildimi.
export function applyClose(zone: Zone, index: number, close: number, atr: number, breakCloseAtr: number): boolean {
  const side = clearSideOf(close, zone, atr, breakCloseAtr);
  if (side === null) return false;
  if (zone.clearSide !== null && side !== zone.clearSide) {
    zone.status = 'invalid';
    zone.invalidatedIndex = index;
    return true;
  }
  zone.clearSide = side;
  return false;
}

// S/D zona staleTests martadan ko'p test qilinsa eskiradi (o'chirilmaydi, past ball oladi).
// S/R uchun esa testlar zonani kuchaytiradi, shuning uchun u eskirmaydi.
export function updateStaleness(zone: Zone, params: AlgoParams) {
  if (zone.status === 'active' && isSupplyDemand(zone) && zone.tests.length >= params.staleTests) {
    zone.status = 'stale';
  }
}
