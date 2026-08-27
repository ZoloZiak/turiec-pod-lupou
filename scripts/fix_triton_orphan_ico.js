// WATCH tik #45 (IČO stráž) — oprava zameneného subjektu.
// Orphan entita IČO 47566884 name="TRITON spol. s.r.o." má 0 transakcií, ale IČO 47566884
// v RPO ŠÚ SR patrí firme "Triton SECURITY, s.r.o." (Liptovský Mikuláš) — NIE bratislavskému
// TRITONu. Reálny dodávateľ mesta Martin je "T R I T O N spol. s r. o." IČO 31323642
// (CRZ zmluva 10813160 potvrdená, 2 tx, samostatná správna entita 34ef9418...).
// Orphan 47566884 = defektný duplikát so zlým (cudzím) IČO. Bezpečné zmazať (0 tx).
// Idempotentný: dry-run default, --apply vykoná. Guard: zmaže LEN ak ico=47566884
// A name obsahuje TRITON A 0 supplier tx A 0 buyer tx (inak abort).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const ICO = '47566884';

async function countTx(col, id) {
  const { count, error } = await supabase.from('transactions')
    .select('*', { count: 'exact', head: true }).eq(col, id);
  if (error) throw new Error(error.message);
  return count;
}

(async () => {
  const { data: ents, error } = await supabase.from('entities').select('id, name, ico').eq('ico', ICO);
  if (error) { console.log('ERR: ' + error.message); return; }
  if (!ents.length) { console.log('SKIP: entita s IČO ' + ICO + ' už neexistuje (idempotentné).'); return; }
  if (ents.length > 1) { console.log('ABORT: viac než 1 entita s IČO ' + ICO + ' — ručne.'); return; }
  const e = ents[0];
  console.log(`Nájdená entita id=${e.id} name="${e.name}" ico=${e.ico}`);
  if (!/triton/i.test(e.name || '')) { console.log('ABORT: názov neobsahuje TRITON — guard.'); return; }
  const supCnt = await countTx('supplier_entity_id', e.id);
  const buyCnt = await countTx('buyer_entity_id', e.id);
  console.log(`  supplier tx=${supCnt}, buyer tx=${buyCnt}`);
  if (supCnt !== 0 || buyCnt !== 0) { console.log('ABORT: entita má transakcie — NEMAZAŤ, ručne.'); return; }
  if (!APPLY) { console.log('\n[DRY-RUN] zmazal by som orphan entitu ' + e.id + ' (0 tx, zlé IČO cudzej firmy). Spusti s --apply.'); return; }
  const { error: delErr } = await supabase.from('entities').delete().eq('id', e.id);
  if (delErr) { console.log('ERR delete: ' + delErr.message); return; }
  console.log('[APPLY] Zmazaná orphan entita ' + e.id + ' (IČO ' + ICO + ').');
})().catch(e => console.log('FATAL: ' + e.message));
