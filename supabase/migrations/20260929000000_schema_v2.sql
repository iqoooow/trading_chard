-- Schema v2: zona-tahlil algoritmi uchun
--
-- Idempotent: ham mavjud bazada (candles ma'lumotlari saqlanadi), ham bo'sh bazada
-- ishlaydi va ikkalasida bir xil sxema hosil qiladi. Qayta ishga tushirish xavfsiz:
-- candles saqlanadi, hisoblangan natijalar (run/swing/zona) o'chadi va keyingi
-- cron'da qayta hisoblanadi.
--
-- Zonalar har kuni to'liq qayta hisoblanadi. Har bir hisoblash — bitta analysis_runs
-- qatori: algoritm avval run'ni 'running' holatda yaratadi, swing/zona/testlarni yozadi,
-- keyin 'completed' qiladi. Frontend faqat oxirgi 'completed' run'ni o'qiydi, shuning
-- uchun yarim yozilgan holatni hech kim ko'rmaydi. Eski run'lar CASCADE bilan o'chiriladi.

-- ============================================================
-- candles — yagona manba ma'lumoti (mavjud ma'lumotlar saqlanadi)
-- ============================================================
CREATE TABLE IF NOT EXISTS candles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol     TEXT NOT NULL,
    timeframe  TEXT NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL,
    open       NUMERIC NOT NULL,
    high       NUMERIC NOT NULL,
    low        NUMERIC NOT NULL,
    close      NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mavjud jadvalni yuqoridagi ta'rifga moslash
ALTER TABLE candles ALTER COLUMN symbol TYPE TEXT;
-- Default'lar olib tashlanadi: eski default 'XAU_USD' kod yozadigan 'XAU/USD' bilan mos emas edi
ALTER TABLE candles ALTER COLUMN symbol DROP DEFAULT;
ALTER TABLE candles ALTER COLUMN timeframe DROP DEFAULT;
ALTER TABLE candles ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE candles ALTER COLUMN created_at SET NOT NULL;

-- Upsert (onConflict: symbol,timeframe,timestamp) uchun unique index.
-- Eski bazadagi constraint nomi noma'lum, shuning uchun ustunlar bo'yicha tekshiramiz.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = 'candles'::regclass
          AND i.indisunique
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM pg_attribute a
              WHERE a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          ) = ARRAY['symbol', 'timeframe', 'timestamp']
    ) THEN
        CREATE UNIQUE INDEX candles_symbol_timeframe_timestamp_key
            ON candles (symbol, timeframe, timestamp);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candles_ohlc_check') THEN
        ALTER TABLE candles ADD CONSTRAINT candles_ohlc_check CHECK (
            low > 0
            AND high >= GREATEST(open, close)
            AND low <= LEAST(open, close)
        );
    END IF;
END $$;

-- ============================================================
-- Algoritm jadvallari — faqat hisoblangan natijalar, v2 tuzilmasi bilan qayta yaratiladi
-- (eski bazada bo'sh edi)
-- ============================================================
DROP TABLE IF EXISTS zone_tests CASCADE;
DROP TABLE IF EXISTS swing_points CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS analysis_runs CASCADE;

-- ============================================================
-- analysis_runs — bitta to'liq hisoblash (parametrlar bilan, qayta tiklash mumkin)
-- ============================================================
CREATE TABLE analysis_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol        TEXT NOT NULL,
    timeframe     TEXT NOT NULL,
    algo_version  TEXT NOT NULL,
    params        JSONB NOT NULL,                -- N, ATR ko'paytmalari, ball og'irliklari
    candles_from  TIMESTAMPTZ,                   -- hisoblashda ishlatilgan oraliq
    candles_to    TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'failed')),
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX analysis_runs_latest_idx
    ON analysis_runs (symbol, timeframe, status, created_at DESC);

-- ============================================================
-- swing_points — fraktal swing high/low nuqtalari
-- ============================================================
CREATE TABLE swing_points (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    candle_id     UUID NOT NULL REFERENCES candles(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('high', 'low')),
    price         NUMERIC NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL,          -- swing shami sanasi
    confirmed_at  TIMESTAMPTZ NOT NULL,          -- o'ngdagi N sham yopilgan sana (look-ahead himoyasi)
    CHECK (confirmed_at >= occurred_at)
);

CREATE INDEX swing_points_run_idx ON swing_points (run_id, occurred_at);

-- ============================================================
-- zones — S/R, Supply/Demand va super-zonalar
-- ============================================================
CREATE TABLE zones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('sr', 'supply', 'demand', 'super')),
    top_price       NUMERIC NOT NULL,
    bottom_price    NUMERIC NOT NULL,
    formed_at       TIMESTAMPTZ NOT NULL,        -- zonani hosil qilgan birinchi sham
    confirmed_at    TIMESTAMPTZ NOT NULL,        -- zona ma'lum bo'lgan sana (backtestda shundan oldin ishlatilmaydi)
    atr_at_formation NUMERIC NOT NULL,
    test_count      INTEGER NOT NULL DEFAULT 0 CHECK (test_count >= 0),
    last_tested_at  TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'stale', 'invalid')),
    invalidated_at  TIMESTAMPTZ,
    -- Ball komponentlari (0–100). Yakuniy: sr × 0.4 + sd × 0.4 + tf × 0.2 (+ super-zona bonusi)
    sr_score        NUMERIC NOT NULL DEFAULT 0 CHECK (sr_score BETWEEN 0 AND 100),
    sd_score        NUMERIC NOT NULL DEFAULT 0 CHECK (sd_score BETWEEN 0 AND 100),
    tf_score        NUMERIC NOT NULL DEFAULT 0 CHECK (tf_score BETWEEN 0 AND 100),
    score           NUMERIC NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    CHECK (top_price >= bottom_price),
    CHECK (confirmed_at >= formed_at),
    CHECK ((status = 'invalid') = (invalidated_at IS NOT NULL))
);

CREATE INDEX zones_run_idx ON zones (run_id, status, score DESC);

-- ============================================================
-- zone_tests — narx zonaga har kirgani va reaksiyasi (backtest uchun ham)
-- ============================================================
CREATE TABLE zone_tests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id        UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    candle_id      UUID NOT NULL REFERENCES candles(id) ON DELETE CASCADE,
    tested_at      TIMESTAMPTZ NOT NULL,
    reaction_type  TEXT NOT NULL CHECK (reaction_type IN ('bounce', 'break', 'pending')),
    reaction_atr   NUMERIC,                      -- keyingi 5 kundagi qarama-qarshi harakat, ATR birligida
    UNIQUE (zone_id, candle_id)
);

CREATE INDEX zone_tests_zone_idx ON zone_tests (zone_id, tested_at);

-- ============================================================
-- Row Level Security: hammaga faqat o'qish; yozish faqat service role orqali
-- ============================================================
ALTER TABLE candles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_points  ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_tests    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON candles;
CREATE POLICY "Public read" ON candles       FOR SELECT USING (true);
CREATE POLICY "Public read" ON analysis_runs FOR SELECT USING (true);
CREATE POLICY "Public read" ON swing_points  FOR SELECT USING (true);
CREATE POLICY "Public read" ON zones         FOR SELECT USING (true);
CREATE POLICY "Public read" ON zone_tests    FOR SELECT USING (true);

-- PostgREST yangi jadvallarni darhol ko'rishi uchun
NOTIFY pgrst, 'reload schema';
