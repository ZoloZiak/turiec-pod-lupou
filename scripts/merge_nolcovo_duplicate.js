// MERGE: duplicitna entita Univerzitná nemocnica — zla (31386563 = UN AGEL Milosrdni bratia BA podla RPO) do dobrej (00365327 UNM Martin).
// Idempotentny, dry-run default, --apply.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const WRONG_ID = '47653b01-bff6-4863-9f41-c989564ee924'; // ico 31386563 "Univerzitná nemocnica"
const RIGHT_ID = 'cdd53cdc-9e9f-4c06-abca-841212cafb37'; // ico 00365327 Univerzitná nemocnica Martin

async function count(col) {
  const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq(col, WRONG_ID);
  if (error) throw error;
  return count;
}

(async () => {
  // sanity: wrong entita musi mat stare ICO
  const { data: w } = await supabase.from('entities').select('id,name,ico').eq('id', WRONG_ID).maybeSingle();
  if (!w || w.ico !== '31386563') { console.log('SKIP: zla entita uz neexistuje / uz je zmerged (idempotentny beh).'); return; }

  const nb = await count('buyer_entity_id');
  const ns = await count('supplier_entity_id');
  console.log(`${APPLY ? 'APPLY' : 'DRY '}: presuniem buyer=${nb}, supplier=${ns} transakcii na spravnu entitu a zlu entitu zmazem.`);
  if (!APPLY) return;

  const e1 = await supabase.from('transactions').update({ buyer_entity_id: RIGHT_ID }).eq('buyer_entity_id', WRONG_ID);
  if (e1.error) { console.error('buyer update:', e1.error.message); process.exit(1); }
  const e2 = await supabase.from('transactions').update({ supplier_entity_id: RIGHT_ID }).eq('supplier_entity_id', WRONG_ID);
  if (e2.error) { console.error('supplier update:', e2.error.message); process.exit(1); }
  const d = await supabase.from('entities').delete().eq('id', WRONG_ID);
  if (d.error) { console.error('delete:', d.error.message); process.exit(1); }
  console.log('HOTOVO: merged.');
})();
