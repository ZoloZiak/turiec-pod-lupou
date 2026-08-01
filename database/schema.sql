-- ==============================================================================
-- TURIEC POD LUPOU - ZÁKLADNÁ ŠTRUKTÚRA DATABÁZY
-- ==============================================================================
-- Tento skript spusti v Supabase v sekcii "SQL Editor" -> "New Query"

-- 1. ENUM Typy
CREATE TYPE entity_type AS ENUM ('MUNICIPALITY', 'COMPANY', 'NGO', 'PERSON');
CREATE TYPE source_type AS ENUM ('CRZ_CONTRACT', 'WEB_INVOICE');

-- 2. Tabuľka: Entities (Subjekty - Objednávatelia aj Dodávatelia)
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ico VARCHAR(50) UNIQUE, -- Ak neexistuje IČO, je null, ale inak musí byť unikátne
    name VARCHAR(255) NOT NULL,
    type entity_type DEFAULT 'COMPANY',
    normalized_name VARCHAR(255), -- Na vyhľadávanie bez s.r.o. a diakritiky
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pre rýchle hľadanie podľa IČO a názvu
CREATE INDEX idx_entities_ico ON entities(ico);
CREATE INDEX idx_entities_normalized_name ON entities(normalized_name);

-- 3. Tabuľka: Transactions (Finančné toky - Zmluvy a Faktúry)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type source_type NOT NULL,
    source_url TEXT, -- Link priamo na zmluvu/faktúru na štátnom webe
    buyer_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    supplier_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    amount_eur DECIMAL(15, 2) NOT NULL, -- Suma v Eurách (konečná s DPH ak je)
    date_published DATE NOT NULL, -- Dátum zverejnenia alebo podpisu
    subject TEXT, -- Predmet (napr. "Oprava chodníka")
    external_id VARCHAR(255) UNIQUE, -- ID z CRZ (ochrana proti stiahnutiu tej istej zmluvy 2x)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pre analytiku a frontend
CREATE INDEX idx_transactions_buyer ON transactions(buyer_entity_id);
CREATE INDEX idx_transactions_supplier ON transactions(supplier_entity_id);
CREATE INDEX idx_transactions_amount ON transactions(amount_eur DESC);
CREATE INDEX idx_transactions_date ON transactions(date_published DESC);

-- ==============================================================================
-- DUMMY DÁTA PRE OTESTOVANIE (Voliteľné)
-- ==============================================================================
/*
INSERT INTO entities (ico, name, type) VALUES 
('36387959', 'Martinská parkovacia spoločnosť, a.s.', 'COMPANY'),
('53560922', 'Dopravný podnik mesta Martin, s.r.o.', 'COMPANY'),
('12345678', 'Firma Krtko a syn', 'COMPANY');

-- Predpokladajme, že poznáme ID, v praxi by sme na to použili sub-select, 
-- ale pre dummy dáta ti stačí overiť prázdne tabuľky:
SELECT * FROM entities;
*/
