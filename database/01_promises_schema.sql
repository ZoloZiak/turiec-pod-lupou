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

-- 3. Vzorové dáta — ODSTRÁNENÉ (audit cyklus 2, T18 fabrication-sweep)
-- POZOR: pôvodný seed obsahoval NEOVERENÉ statusy sľubov menovanej osoby
-- (Ján Danko: 'ZABUDNUTÉ' / 'SPLNENÉ') — hodnotiace tvrdenia o plnení
-- volebného programu bez doloženého zdroja. source_url 'martin.sk/volebny-program'
-- je navyše MŔTVY (404). V DB boli tieto statusy neutralizované na 'V RIEŠENÍ'
-- a mŕtvy link opravený (audit T10). Aby re-spustenie tejto schémy nevrátilo
-- nepravdivé statusy ani duplicity, seed je odstránený.
-- NEVKLADAJ sem statusy plnenia sľubov menovaných osôb bez overeného zdroja
-- a bez ľudského posúdenia (poistka menovaných osôb).
--
-- INSERT INTO promises (title, description, status, politician_name, source_url) VALUES
-- ('Zelenšie mesto a údržba parkov', '...', 'V RIEŠENÍ', 'Ján Danko', 'https://www.martin.sk/'),
-- ('Nové parkovacie miesta', '...', 'V RIEŠENÍ', 'Ján Danko', 'https://www.martin.sk/'),
-- ('Transparentnejšie obstarávanie', '...', 'V RIEŠENÍ', 'Ján Danko', 'https://www.martin.sk/');
