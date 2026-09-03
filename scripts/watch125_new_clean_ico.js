// READ-ONLY WATCH #125: identifikuj NOVÉ clean 8-cifrové IČO čo Krtko pridal cez noc.
// Delta result (WATCH_ico_delta_result.json) zachytil onlyDb proti 318-baseline pred
// prepísaním setu. Filter pre /^\d{8}$/ = nové clean IČO mimo auditovaného setu.
// Navyše: pre každé také IČO zisti tx dopad (buyer/supplier) + sample source_url.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const delta = JSON.parse(fs.readFileSync('.audit/WATCH_ico_delta_result.json', 'utf8'));
  const newClean = (delta.onlyDb || []).filter(e => /^\d{8}$/.test(String(e.ico)));
  console.log('NOVÉ clean 8-cifrové IČO v DB mimo 318-setu: ' + newClean.length);
  const out = [];
  for (const e of newClean) {
    // nájdi entity id + tx dopad
    const { data: ents } = await sb.from('entities').select('id,ico,name').eq('ico', e.ico);
    let detail = [];
    for (const ent of (ents || [])) {
      const { count: bc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', ent.id);
      const { count: sc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', ent.id);
      let sample = null;
      const { data: bs } = await sb.from('transactions').select('source_url,source_type,amount_eur,created_at').eq('buyer_entity_id', ent.id).limit(1);
      const { data: ss } = await sb.from('transactions').select('source_url,source_type,amount_eur,created_at').eq('supplier_entity_id', ent.id).limit(1);
      sample = (bs && bs[0]) || (ss && ss[0]) || null;
      detail.push({ id: ent.id, name: ent.name, asBuyer: bc || 0, asSupplier: sc || 0, sample });
    }
    out.push({ ico: e.ico, name: e.name, entities: detail });
    console.log(`\n== ${e.ico} | ${e.name} ==`);
    for (const d of detail) console.log(`   ent=${d.id} "${d.name}" B=${d.asBuyer} S=${d.asSupplier} src=${d.sample ? d.sample.source_type + ' ' + d.sample.source_url + ' amt=' + d.sample.amount_eur + ' at=' + d.sample.created_at : 'none'}`);
  }
  fs.writeFileSync('.audit/WATCH125_new_clean_ico.json', JSON.stringify(out, null, 2));
})();
