CREATE TABLE asset_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  role TEXT NOT NULL,
  year INTEGER NOT NULL,
  official_salary_eur DECIMAL NOT NULL,
  declared_assets TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- POZOR: pôvodné 'sample data' (Ján Danko, primátor) boli VYMYSLENÉ, neoverené
-- údaje o menovanej osobe, zverejnené pod falošným 'Certifikát dát z NRSR'.
-- Boli odstránené (audit). Tabuľka ostáva prázdna, kým nebude reálny overený zdroj.
-- NEVKLADAJ sem neoverené majetkové priznania.

-- Enable RLS
ALTER TABLE asset_declarations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow public read-only access to asset_declarations" 
ON asset_declarations FOR SELECT USING (true);
