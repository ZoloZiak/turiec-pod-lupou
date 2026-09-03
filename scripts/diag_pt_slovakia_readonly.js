// READ-ONLY diag WATCH #54: tx pre entitu IČO 52219763 (spravna schema)
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function pageAll(makeBuilder) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await makeBuilder().range(from, from + 999);
    if (error) { console.error('ERR', error.message); break; }
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}
(async () => {
  const { data: ents } = await sb.from('entities').select('id,ico,name,type').or('ico.eq.52219763,name.ilike.%PT Slovakia%');
  console.log('ENTITIES:', JSON.stringify(ents, null, 1));
  const cols = 'id,source_type,source_url,buyer_entity_id,supplier_entity_id,amount_eur,date_published,subject,external_id';
  const out = { entities: ents || [], tx: [] };
  for (const e of ents || []) {
    const asSupplier = await pageAll(() => sb.from('transactions').select(cols).eq('supplier_entity_id', e.id));
    const asBuyer = await pageAll(() => sb.from('transactions').select(cols).eq('buyer_entity_id', e.id));
    out.tx.push({ ico: e.ico, name: e.name, id: e.id, asSupplier: asSupplier.length, asBuyer: asBuyer.length, supplierRows: asSupplier, buyerRows: asBuyer });
    console.log(`ENT ${e.ico} ${e.name}: supplier=${asSupplier.length} buyer=${asBuyer.length}`);
    for (const t of [...asSupplier, ...asBuyer]) console.log('  TX', t.external_id, t.source_type, t.amount_eur, '|', (t.subject || '').slice(0, 70), '|', t.source_url);
  }
  fs.writeFileSync('/tmp/diag_52219763.json', JSON.stringify(out, null, 1));
})();
