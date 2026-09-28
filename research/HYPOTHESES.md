# Tadqiqot: oldindan ro'yxatga olingan gipotezalar

Sana: 2026-09-29 · Algoritm: v0.1.0 · Bu fayl natijalar olinishidan **oldin** yozilgan va commit qilingan.

## Nega oldindan yozamiz

Bir xil ma'lumotda ko'p g'oya sinalsa, ulardan biri tasodifan yaxshi ko'rinadi. Shuning uchun
gipotezalar, o'lchov va qaror qoidasi natijani ko'rishdan oldin qat'iy belgilanadi. Natijaga
qarab parametrlarni o'zgartirish taqiqlanadi — yangi g'oya yangi gipoteza bo'ladi va yangi
ma'lumotda sinaladi.

## Ma'lumotlar

| Bosqich | Ma'lumot | Holati |
|---|---|---|
| Kashfiyot | XAU/USD, 2009-02-09 → 2021-02-24 (train) | Avval ko'rilgan (v0.1.0 backtest va parametr to'ri) |
| Tasdiqlash | XAG/USD va EUR/USD, to'liq tarix (TwelveData, ≤5000 kunlik sham) | **Hech qachon ko'rilmagan** |
| Faqat ma'lumot uchun | XAU/USD, 2021-02-25 → 2026-09-25 (test) | 2 marta ko'rilgan — qarorda ishlatilmaydi |
| Haqiqiy holdout | XAU/USD, 2026-09-26 dan keyingi yangi shamlar | Kelajak |

## Metodika (v0.1.0 backtest bilan bir xil)

- Walk-forward: t-kunda algoritm faqat 0..t−1 shamlarni ko'radi; zonaga yangi kirish = hodisa.
- Nazorat: har bir zonaning ±1..4 ATR siljitilgan 5 ta "soya" nusxasi (kenglik va muddat bir xil).
- Natija: zonaga kirgach `oyna` kun ichida, qarama-qarshi tomonda aniq yopilishdan (0.5 ATR)
  oldin `≥ qaytish` ATR harakat → muvaffaqiyat; buzilish → fail.
- Statistika: haqiqiy va nazorat ulushlari farqi, ikki ulush z-testi.
- Barcha algoritm parametrlari: `DEFAULT_PARAMS` (v0.1.0), o'zgartirilmaydi.

## Gipotezalar

| # | Gipoteza | Nimani o'lchaymiz | Bashorat |
|---|---|---|---|
| H1 | Kamida 2 marta tasdiqlangan (≥2 swing) S/R va super-zonalar ishlaydi | Faqat shu zonalar hodisalarida muvaffaqiyat farqi | Farq > 0 |
| H2 | Haftalik grafik zonalari (yuqori timeframe) kunlik grafikda ishlaydi | Haftalik tirik zonalarga kunlik kirishlar, muvaffaqiyat farqi | Farq > 0 |
| H3 | Zonalar qaytish emas, **o'tib ketish** (breakout) darajalari | Barcha zonalar, **buzilish** ulushi farqi | Farq > 0 |
| H4a | Zonalar uzoqroq muddatda ishlaydi: oyna 10 kun, qaytish ≥1.5 ATR | Barcha zonalar, muvaffaqiyat farqi | Farq > 0 |
| H4b | Oyna 20 kun, qaytish ≥2 ATR | Barcha zonalar, muvaffaqiyat farqi | Farq > 0 |

H3 haqida: bu g'oya v0.1.0 natijalaridan (zonalar soyalardan biroz ko'proq buzilgan) kelib chiqqan,
ya'ni XAU/USD da allaqachon "ko'rilgan". Shuning uchun uning XAU/USD natijasi qarorda hisobga
olinmaydi — u **to'g'ridan-to'g'ri tasdiqlash bosqichida** baholanadi.

## Qaror qoidasi

1. **Kashfiyot (XAU/USD train):** gipoteza bashorat qilingan yo'nalishda `z ≥ 2.58` bo'lsa va kamida
   100 ta haqiqiy hodisa bo'lsa, o'tadi. 2.58 — Bonferroni tuzatmasi: 5 ta test, umumiy α = 0.05
   (har biri uchun 0.01, ikki tomonlama).
2. **Tasdiqlash:** kashfiyotdan o'tgan gipoteza (va H3) **ikkala** yangi instrumentda (XAG/USD va
   EUR/USD) bir xil yo'nalishda `z ≥ 1.96` bersa — **tasdiqlandi**.
3. Aks holda — **rad etildi**. Qisman natijalar ("bitta instrumentda ishladi") tasdiq hisoblanmaydi.
4. Tasdiqlangan gipoteza ham faqat keyingi bosqichga (forward test, yangi shamlar) o'tadi —
   bu hali savdo signali emas.

## Cheklovlar

- Bir kunda bir nechta zonaga kirish va soyalar bir-biriga bog'liq — z-test ishonchni biroz
  oshirib ko'rsatadi. Shuning uchun chegara qat'iy (2.58) va ikki instrumentda takrorlanish talab qilinadi.
- TwelveData kunlik shamlari UTC chegarasida; boshqa manbada natija biroz farq qilishi mumkin.
