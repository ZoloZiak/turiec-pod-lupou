// gen_direction_sql.js — deterministicky generuje database/add_direction_column.sql
// zo ZDROJA PRAVDY src/lib/income-ids.ts (INCOME_TX_IDS + INCOME_TX_COUNT).
//
// DOVOD (audit cyklus 2, T18): add_direction_column.sql bol zastaraly — obsahoval
// len 87 INCOME ID z cyklu 1, kym income-ids.ts ma po oprave T17 uz 129 ID.
// Route /api/data preferuje DB stlpec `direction` pred statickym INCOME_TX_IDS
// (ak stlpec existuje, cita sa z DB). Spustenie zastaraleho SQL by teda vratilo
// 42 NFP/dotacnych zmluv (30,2M EUR) spat na EXPENSE a nafuklo hero vydavky.
// Tento generator drzi SQL v synchro so zdrojom pravdy.
//
// Pouzitie:  node scripts/gen_direction_sql.js          (dry-run, vypise co by zapisal)
//            node scripts/gen_direction_sql.js --apply   (prepise SQL subor)

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'lib', 'income-ids.ts');
const OUT = path.join(__dirname, '..', 'database', 'add_direction_column.sql');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const ts = fs.readFileSync(SRC, 'utf8');

// Extrahuj len UUID v ramci Set<string>([ ... ]) — nie z komentarov mimo.
const setStart = ts.indexOf('INCOME_TX_IDS = new Set<string>([');
const setEnd = ts.indexOf(']);', setStart);
if (setStart === -1 || setEnd === -1) {
  console.error('CHYBA: neviem najst INCOME_TX_IDS Set v income-ids.ts');
  process.exit(1);
}
const setBody = ts.slice(setStart, setEnd);
const ids = [...new Set((setBody.match(UUID_RE) || []).map((s) => s.toLowerCase()))];

const countMatch = ts.match(/INCOME_TX_COUNT\s*=\s*(\d+)/);
const declaredCount = countMatch ? parseInt(countMatch[1], 10) : null;

if (declaredCount !== null && declaredCount !== ids.length) {
  console.error(`CHYBA: INCOME_TX_COUNT (${declaredCount}) != pocet UUID (${ids.length}) — neopravene, zastav.`);
  process.exit(1);
}

const header = `-- add_direction_column.sql
-- AUTO-GENEROVANE cez scripts/gen_direction_sql.js zo zdroja pravdy src/lib/income-ids.ts.
-- NEUPRAVUJ RUCNE — uprav income-ids.ts a re-generuj, inak sa SQL a appka rozidu.
-- DDL prava z app klienta NIE su dostupne -> SPUSTI RUCNE v Supabase SQL editore
-- (Dashboard -> SQL Editor) alebo cez psql so service/db heslom.
--
-- Smer penazi z pohladu mesta: EXPENSE = mesto plati (default), INCOME = mesto dostava.
-- Pocet INCOME zmluv: ${ids.length} (musi sediet s INCOME_TX_COUNT v income-ids.ts).

-- 1. Pridaj stlpec direction (default EXPENSE pre vsetky existujuce zaznamy).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'EXPENSE';

-- 2. Oznac INCOME zmluvy (${ids.length} kusov, NFP/dotacie/granty od statu — mesto je prijimatel).
UPDATE transactions SET direction = 'INCOME' WHERE id IN (
`;

const idLines = ids.map((id, i) => `  '${id}'${i === ids.length - 1 ? '' : ','}`).join('\n');

const footer = `
);

-- 3. (volitelne) index pre filtrovanie podla smeru
CREATE INDEX IF NOT EXISTS idx_transactions_direction ON transactions(direction);

-- Overenie po spusteni:
-- SELECT direction, count(*), sum(amount_eur) FROM transactions GROUP BY direction;
`;

const sql = header + idLines + footer;

const apply = process.argv.includes('--apply');
if (apply) {
  fs.writeFileSync(OUT, sql, 'utf8');
  console.log(`ZAPISANE: ${OUT} (${ids.length} INCOME ID).`);
} else {
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const existingIds = [...new Set((existing.match(UUID_RE) || []).map((s) => s.toLowerCase()))];
  console.log(`DRY-RUN. Zdroj pravdy income-ids.ts: ${ids.length} INCOME ID.`);
  console.log(`Aktualny SQL subor: ${existingIds.length} INCOME ID.`);
  const missing = ids.filter((id) => !existingIds.includes(id));
  const extra = existingIds.filter((id) => !ids.includes(id));
  console.log(`Chybajuce v SQL (pridaju sa): ${missing.length}`);
  console.log(`Navyse v SQL (odstrania sa): ${extra.length}`);
  if (missing.length) console.log('  prvych 5 chybajucich:', missing.slice(0, 5));
  console.log('Spusti s --apply pre zapis.');
}
