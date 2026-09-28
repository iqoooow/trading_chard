-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: candles
CREATE TABLE candles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL,
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    volume NUMERIC,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, timeframe, timestamp)
);

-- Table: swing_points
CREATE TABLE swing_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candle_id UUID REFERENCES candles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('high', 'low')),
    price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: zones
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_price NUMERIC NOT NULL,
    end_price NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supply', 'demand', 'sr')),
    score NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: zone_tests
CREATE TABLE zone_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    candle_id UUID REFERENCES candles(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_tests ENABLE ROW LEVEL SECURITY;

-- Allow read access for public (anon)
CREATE POLICY "Allow public read-only access for candles" ON candles FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access for swing_points" ON swing_points FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access for zones" ON zones FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access for zone_tests" ON zone_tests FOR SELECT USING (true);
