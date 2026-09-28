// Algoritm ichida hamma narsa sham indekslari bilan ishlaydi; sanalarga faqat
// natijani bazaga yozishda (runner) o'giriladi.

export type Candle = {
  id?: string;
  timestamp: string; // ISO, UTC — kun (yoki hafta) boshlanishi
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SwingType = 'high' | 'low';

export type SwingPoint = {
  index: number; // swing shami
  confirmedIndex: number; // o'ngdagi N sham yopilgan sham — shundan oldin swing ma'lum emas
  type: SwingType;
  price: number;
};

export type ZoneKind = 'sr' | 'supply' | 'demand' | 'super';
export type ZoneStatus = 'active' | 'stale' | 'invalid';
export type ReactionType = 'bounce' | 'break' | 'pending';
export type Side = 'above' | 'below';

export type ZoneTest = {
  index: number; // narx zonaga kirgan sham
  approach: Side; // narx zonaga qaysi tomondan keldi
  zoneTop: number; // test paytidagi zona chegaralari (S/R zona keyinroq kengayishi mumkin)
  zoneBottom: number;
  atr: number;
  reactionType: ReactionType;
  reactionAtr: number | null; // oyna ichidagi eng katta qarama-qarshi harakat, ATR birligida
};

export type ZoneScores = {
  sr: number;
  sd: number;
  tf: number;
  total: number;
};

export type Zone = {
  kind: ZoneKind;
  top: number;
  bottom: number;
  formedIndex: number; // zonani hosil qilgan birinchi sham
  confirmedIndex: number; // zona ma'lum bo'lgan sham (look-ahead himoyasi)
  atrAtFormation: number;
  swingPrices: number[]; // S/R: zonaga birlashgan swing narxlari (har biri — bitta touch)
  lastSwingIndex: number | null;
  tests: ZoneTest[];
  status: ZoneStatus;
  invalidatedIndex: number | null;
  clearSide: Side | null; // narx oxirgi marta zonaning qaysi tomonida aniq yopilgan
  scores: ZoneScores;
};
