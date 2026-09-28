// Barcha algoritm parametrlari shu yerda. Har bir hisoblashda ular analysis_runs.params
// ga yoziladi, shuning uchun natijani keyinroq aynan qayta tiklash mumkin.
// Qiymatlar roadmap'dan olingan; backtest natijalariga qarab sozlanadi.

export const ALGO_VERSION = '0.1.0';

export type AlgoParams = {
  atrPeriod: number;
  swingN: number; // fraktal: chap va o'ngdagi N sham (kunlik)
  weeklySwingN: number; // haftalik grafik uchun
  sr: {
    mergeAtr: number; // swing zona markazidan shu masofada bo'lsa birlashtiriladi
    bufferAtr: number; // zona chegarasiga qo'shiladigan bufer
  };
  sd: {
    baseMaxBodyAtr: number; // baza sham tanasi < shu × ATR
    baseMaxCandles: number;
    impulseMinBodyAtr: number; // impuls sham tanasi >= shu × ATR
  };
  breakCloseAtr: number; // zonadan qarama-qarshi tomonda shu × ATR dan uzoq yopilish = bekor
  staleTests: number; // S/D zona shuncha test qilingach "eskirgan"
  reaction: {
    windowCandles: number; // testdan keyin reaksiya o'lchanadigan shamlar soni
    bounceMinAtr: number; // "ishladi" deyish uchun minimal qarama-qarshi harakat
  };
  scoring: {
    weights: { sr: number; sd: number; tf: number };
    superBonus: number;
    maxAgeDays: number; // shundan keyin zona ishonchliligini yo'qota boshlaydi
    recencyHalfLifeDays: number; // S/R: oxirgi touch'dan shuncha kun o'tsa og'irlik yarmiga tushadi
  };
  superMergeAtr: number; // S/R va S/D (yoki kunlik va haftalik) zonalar shu masofada bo'lsa mos keladi
};

export const DEFAULT_PARAMS: AlgoParams = {
  atrPeriod: 14,
  swingN: 5,
  weeklySwingN: 3,
  sr: { mergeAtr: 0.5, bufferAtr: 0.1 },
  sd: { baseMaxBodyAtr: 0.3, baseMaxCandles: 3, impulseMinBodyAtr: 1.5 },
  breakCloseAtr: 0.5,
  staleTests: 3,
  reaction: { windowCandles: 5, bounceMinAtr: 1 },
  scoring: {
    weights: { sr: 0.4, sd: 0.4, tf: 0.2 },
    superBonus: 10,
    maxAgeDays: 300,
    recencyHalfLifeDays: 90,
  },
  superMergeAtr: 0.5,
};
