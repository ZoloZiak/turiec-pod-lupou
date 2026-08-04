CREATE TABLE city_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico TEXT NOT NULL,
  type TEXT,
  profit_loss_eur DECIMAL,
  city_subsidy_eur DECIMAL,
  finstat_url TEXT,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nku_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  penalty_eur DECIMAL DEFAULT 0,
  year INTEGER NOT NULL,
  report_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE eu_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  amount_eur DECIMAL NOT NULL,
  program_name TEXT,
  year INTEGER NOT NULL,
  winner_ico TEXT,
  winner_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE city_council_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  councillor_name TEXT NOT NULL,
  district TEXT,
  vote_cast TEXT NOT NULL, -- 'ZA', 'PROTI', 'ZDRŽAL SA'
  issue_title TEXT NOT NULL,
  vote_date DATE NOT NULL,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE city_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE nku_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE eu_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_council_votes ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to city_companies" ON city_companies FOR SELECT USING (true);
CREATE POLICY "Allow public read access to nku_reports" ON nku_reports FOR SELECT USING (true);
CREATE POLICY "Allow public read access to eu_funds" ON eu_funds FOR SELECT USING (true);
CREATE POLICY "Allow public read access to city_council_votes" ON city_council_votes FOR SELECT USING (true);
