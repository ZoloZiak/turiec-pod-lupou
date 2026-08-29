-- ==============================================================================
-- TURIEC POD LUPOU - SĽUBOMER: prepojenie sľubov na REÁLNE CRZ zmluvy
-- ==============================================================================
-- Naplní promises.related_transaction_ids overiteľnými zmluvami mesta Martin
-- z Centrálneho registra zmlúv (crz.gov.sk), ktoré sú už v tabuľke transactions.
-- Spustiť v Supabase SQL Editor. Idempotentné (matchuje tx podľa external_id,
-- sľub podľa title) — opakované spustenie dá rovnaký výsledok.
--
-- ZÁSADA (anti-halucinácia, audit cyklus 2 / T18): statusy plnenia NEHODNOTÍME
-- bez doloženého zdroja + ľudského posúdenia. Tento seed len PRIPÁJA dôkazy
-- (reálne zmluvy) k sľubom; všetky statusy ostávajú neutrálne 'V RIEŠENÍ'.
-- Sľuby bez jednoznačne priraditeľnej zmluvy v DB (akvapark, zníženie dlhu,
-- transparentnejšie obstarávanie) ostávajú BEZ väzby — dôkaz im nevymýšľame.
--
-- Všetky external_id nižšie boli overené z tabuľky transactions (2026-08-29).
-- Každé zodpovedá živej zmluve https://crz.gov.sk/zmluva/<id>/.
-- ==============================================================================

-- Bezplatná MHD  (3 zmluvy, 8 400 000,76 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_10259786','crz_8709893','crz_7303370')
) WHERE title = 'Bezplatná MHD';

-- Oprava ciest a chodníkov  (5 zmlúv, 3 195 622,78 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_12520464','crz_12393408','crz_10638558','crz_11009331','crz_11026426')
) WHERE title = 'Oprava ciest a chodníkov';

-- Výstavba domovov pre seniorov  (4 zmluvy, 2 645 000,58 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_8771290','crz_8952321','crz_10003078','crz_10550719')
) WHERE title = 'Výstavba domovov pre seniorov';

-- Zelenšie mesto a údržba parkov  (4 zmluvy, 1 420 794,04 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_10557230','crz_12290562','crz_12616353','crz_11824864')
) WHERE title = 'Zelenšie mesto a údržba parkov';

-- Lanovka na Martinské hole  (3 zmluvy, 150 080 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_12714918','crz_12409465','crz_12712246')
) WHERE title = 'Lanovka na Martinské hole';

-- Nové parkovacie miesta  (3 zmluvy, 15 160 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_10241953','crz_9220008','crz_12731606')
) WHERE title = 'Nové parkovacie miesta';

-- Parkovacia politika (Parkovacie domy)  (3 zmluvy, 1 960 €)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_10979509','crz_9223868','crz_12731606')
) WHERE title = 'Parkovacia politika (Parkovacie domy)';

-- Výstavba Univerzitnej nemocnice  (4 zmluvy, prípravné/bezodplatné)
UPDATE promises SET related_transaction_ids = (
  SELECT array_agg(id) FROM transactions WHERE external_id IN
  ('crz_10434350','crz_10516440','crz_11874251','crz_12602252')
) WHERE title = 'Výstavba Univerzitnej nemocnice';

-- ------------------------------------------------------------------------------
-- PREHĽAD (stav po behu, overené z DB 2026-08-29):
--   8/11 sľubov doložených, 29 väzieb na reálne CRZ zmluvy.
--   3 sľuby bez dokladu (akvapark, zníženie dlhu, transparentnejšie obstarávanie).
--   Všetky statusy: 'V RIEŠENÍ' (neutrálne, nehodnotené).
-- ==============================================================================
