#!/usr/bin/env node
// WATCH #106 fix — CRZ suma regresia: crz_12731899 (Zmluva o dielo 05/IO/2026,
// zateplenie ZŠ s MŠ J. V. Dolinského, Mesto Martin ↔ MIPE Invest s.r.o.).
// CRZ detail (crz.gov.sk/zmluva/12731899/) bol medzi WATCH #102 (30.8., 7 872 000 €)
// a #106 (31.8.) OPRAVENÝ v registri na 787 200,00 € (Zmluvne dohodnutá aj Celková
// čiastka). DB drží zastaralých 7 872 000 (10× nafúknuté) → zosúlaď s aktuálnym CRZ.
// Idempotentný: default dry-run; --apply vykoná update. Bezpečné opakované spustenie.
// usage: node scripts/fix_crz_12731899_amount.js [--apply]
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const ROW_ID = '8fd71cf7-0d7c-4d61-bb69-2d41fdaa90e6';
const EXTERNAL_ID = 'crz_12731899';
const EXPECTED_OLD = 7872000;      // zastaralá nafúknutá hodnota (dovoľ aj už-opravenú)
const NEW_AMOUNT = 787200;         // aktuálna CRZ realita: 787 200,00 €

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
  if (Math.abs(row.amount_eur - NEW_AMOUNT) <= 0.01) {
    console.log('ALREADY FIXED (amount == 787200). Nič na zmenu. Idempotentné.'); return;
  }
  if (Math.abs(row.amount_eur - EXPECTED_OLD) > 0.01) {
    console.error(`GUARD FAIL: amount ${row.amount_eur} nie je ani očakávaná stará (7872000) ani nová (787200). ABORT — over ručne.`);
    process.exit(1);
  }

  console.log(`\nZMENA: amount_eur ${row.amount_eur} -> ${NEW_AMOUNT}  (CRZ 12731899 = 787 200,00 €)`);
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
