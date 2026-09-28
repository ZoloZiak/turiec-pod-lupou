#!/usr/bin/env node
// WATCH #214 fix — CRZ suma regresia: crz_12755213 (Zmluva o propagácii a reklame,
// O-78/2026, Turčianska vodárenská spoločnosť a.s. 36672084 ↔ Obec Jazernica 00316725).
// CRZ detail (crz.gov.sk/zmluva/12755213/) uvádza jednoznačne "Zmluvne dohodnutá čiastka"
// aj "Celková čiastka" = 200,00 €. DB drží amount_eur=0 → parser Krtko nezachytil sumu
// pri nočnom scrape (dátum zverejnenia 03.09.2026). Zosúlaď DB s realitou CRZ.
// OBE strany = verejné inštitúcie (vodárenská a.s. + obec) → poistka menovaných osôb sa
// NEUPLATŇUJE (len oprava chybnej sumy proti overenému štátnemu registru, žiadne obvinenie).
// Idempotentný: default dry-run; --apply vykoná update. Bezpečné opakované spustenie.
// usage: node scripts/fix_crz_12755213_amount.js [--apply]
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const ROW_ID = 'cd975453-f272-4507-906e-a1cf6de9b990';
const EXTERNAL_ID = 'crz_12755213';
const EXPECTED_OLD = 0;        // pôvodná chybná hodnota (parser nezachytil sumu)
const NEW_AMOUNT = 200;        // aktuálna CRZ realita: 200,00 €

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: row, error } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url, source_type')
    .eq('id', ROW_ID)
    .single();
  if (error) { console.error('READ ERR', error.message); process.exit(1); }
  if (!row) { console.error('ROW NOT FOUND', ROW_ID); process.exit(1); }

  console.log('FOUND:', JSON.stringify({
    id: row.id, external_id: row.external_id, amount_eur: row.amount_eur,
    source_type: row.source_type, source_url: row.source_url,
  }, null, 2));

  // guard: over identitu riadku
  if (row.external_id !== EXTERNAL_ID) {
    console.error(`GUARD FAIL: external_id ${row.external_id} != ${EXTERNAL_ID}`); process.exit(1);
  }
  if (Math.abs((row.amount_eur || 0) - NEW_AMOUNT) <= 0.01) {
    console.log('ALREADY FIXED (amount == 200). Nič na zmenu. Idempotentné.'); return;
  }
  if (Math.abs((row.amount_eur || 0) - EXPECTED_OLD) > 0.01) {
    console.error(`GUARD FAIL: amount ${row.amount_eur} nie je ani očakávaná stará (0) ani nová (200). ABORT — over ručne.`);
    process.exit(1);
  }

  console.log(`\nZMENA: amount_eur ${row.amount_eur} -> ${NEW_AMOUNT}  (CRZ 12755213 = 200,00 €)`);
  if (!APPLY) { console.log('\n[DRY-RUN] Spusti s --apply pre vykonanie.'); return; }

  const { error: uErr } = await supabase
    .from('transactions')
    .update({ amount_eur: NEW_AMOUNT })
    .eq('id', ROW_ID);
  if (uErr) { console.error('UPDATE ERR', uErr.message); process.exit(1); }

  const { data: after, error: rErr } = await supabase
    .from('transactions').select('id, amount_eur').eq('id', ROW_ID).single();
  if (rErr) { console.error('RE-READ ERR', rErr.message); process.exit(1); }
  console.log('APPLIED. amount_eur teraz =', after.amount_eur);
}

main().catch((e) => { console.error(e); process.exit(1); });
