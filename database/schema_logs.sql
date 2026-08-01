CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    parsed_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pridaj policy ak máš zapnuté RLS (Row Level Security)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Povoľ čítanie pre všetkých" ON system_logs FOR SELECT USING (true);
CREATE POLICY "Povoľ zápis len adminom" ON system_logs FOR INSERT WITH CHECK (true);
