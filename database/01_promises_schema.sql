-- ==============================================================================
-- TURIEC POD LUPOU - FÁZA 6: SĽUBOMER
-- ==============================================================================
-- Tento skript spusti v Supabase v sekcii "SQL Editor" -> "New Query"

-- 1. ENUM pre stavy sľubov
CREATE TYPE promise_status AS ENUM ('SPLNENÉ', 'V RIEŠENÍ', 'ZABUDNUTÉ');

-- 2. Tabuľka: Promises (Predvolebné sľuby)
CREATE TABLE promises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status promise_status DEFAULT 'V RIEŠENÍ',
    politician_name VARCHAR(100) NOT NULL,
    source_url TEXT,
    related_transaction_ids UUID[] DEFAULT '{}', -- Odkazy na konkrétne ID transakcií (zmluvy, faktúry)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pre rýchlejšie vyhľadávanie podľa politika
CREATE INDEX idx_promises_politician ON promises(politician_name);

-- 3. Vzorové dáta (Sľuby Jána Danka z volieb)
INSERT INTO promises (title, description, status, politician_name, source_url) VALUES 
('Zelenšie mesto a údržba parkov', 'Záväzok zintenzívniť kosenie a revitalizáciu mestských parkov.', 'V RIEŠENÍ', 'Ján Danko', 'https://martin.sk/volebny-program'),
('Nové parkovacie miesta', 'Vybudovanie 500 nových parkovacích miest na sídliskách do konca volebného obdobia.', 'ZABUDNUTÉ', 'Ján Danko', 'https://martin.sk/volebny-program'),
('Transparentnejšie obstarávanie', 'Zavedenie nového elektronického systému pre zverejňovanie všetkých menších zákaziek pod limit.', 'SPLNENÉ', 'Ján Danko', 'https://martin.sk/volebny-program');
