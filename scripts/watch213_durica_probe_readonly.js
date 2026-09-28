// READ-ONLY WATCH #213 probe: dve entity "Adam Ďurica" v DB — 87110170 (RPO NO_EXACT_MATCH)
// vs 53995031 (RPO OK, živnostník BA). Zisti pôvod/transakcie oboch, aby sme rozhodli či
// 87110170 je duplikát/chybné IČO tej istej osoby alebo iný subjekt. ŽIADNY zápis.
// Poistka menovaných osôb: len diagnostika, žiadna zmena bez ďalšej analýzy.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ICOS = ['87110170', '53995031'];

(async () => {
  for (const ico of ICOS) {
    const { data: ents } = await sb.from('entities').select('*').eq('ico', ico);
    console.log(`\n===== IČO ${ico} : ${ents ? ents.length : 0} entít =====`);
    for (const e of (ents || [])) {
      console.log(`  entita id=${e.id} name="${e.name}" created_at=${e.created_at} type=${e.entity_type || e.type || '?'}`);
      const { data: asSup } = await sb.from('transactions').select('id, external_id, amount_eur, subject, date_published').eq('supplier_entity_id', e.id);
      const { data: asBuy } = await sb.from('transactions').select('id, external_id, amount_eur, subject, date_published').eq('buyer_entity_id', e.id);
      console.log(`    ako SUPPLIER: ${asSup ? asSup.length : 0} tx`);
      (asSup || []).forEach(t => console.log(`      [sup] ${t.external_id} | ${t.amount_eur}€ | ${t.date_published} | ${t.subject}`));
      console.log(`    ako BUYER: ${asBuy ? asBuy.length : 0} tx`);
      (asBuy || []).forEach(t => console.log(`      [buy] ${t.external_id} | ${t.amount_eur}€ | ${t.date_published} | ${t.subject}`));
    }
  }
})().catch(e => console.log('FATAL: ' + e.message));
