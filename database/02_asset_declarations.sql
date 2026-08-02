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

-- Insert sample data
INSERT INTO asset_declarations (person_name, role, year, official_salary_eur, declared_assets, source_url) VALUES
('Ján Danko', 'Primátor Mesta Martin', 2023, 76200, 'Byt v Martine, 2x Garáž, Auto VW Touareg, Úspory 45 000 €', 'https://www.nrsr.sk/web/'),
('Ján Danko', 'Primátor Mesta Martin', 2022, 74100, 'Byt v Martine, 2x Garáž, Auto VW Touareg, Úspory 32 000 €', 'https://www.nrsr.sk/web/');

-- Enable RLS
ALTER TABLE asset_declarations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow public read-only access to asset_declarations" 
ON asset_declarations FOR SELECT USING (true);
