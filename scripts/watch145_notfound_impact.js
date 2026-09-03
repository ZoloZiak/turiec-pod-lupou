// READ-ONLY WATCH #145: tx dopad + kontext dvoch NOTFOUND IČO z okna 300-318
// (87110170 "Adam Ďurica", 64833186 "K&K TECHNOLOGY a.s.") — zisti či majú funkčné
// register-linky na webe a odkiaľ pochádzajú (source_url), aby sme rozlíšili fabrikát/
// preklep/rodné číslo vs legitímny zahraničný subjekt.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ICOS = ['87110170', '64833186'];

(async () => {
  const out = [];
  for (const ico of ICOS) {
    const { data: ents } = await sb.from('entities').select('id,ico,name,type').eq('ico', ico);
    const rec = { ico, entities: [] };
    for (const ent of (ents || [])) {
      const { count: bc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', ent.id);
      const { count: sc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', ent.id);
      const { data: bs } = await sb.from('transactions').select('id,source_url,source_type,amount_eur,created_at,description').eq('buyer_entity_id', ent.id).limit(3);
      const { data: ss } = await sb.from('transactions').select('id,source_url,source_type,amount_eur,created_at,description').eq('supplier_entity_id', ent.id).limit(3);
      rec.entities.push({ id: ent.id, name: ent.name, type: ent.type, asBuyer: bc || 0, asSupplier: sc || 0, samplesBuyer: bs || [], samplesSupplier: ss || [] });
    }
    out.push(rec);
    console.log('\n== ' + ico + ' ==');
    for (const e of rec.entities) {
      console.log('  ent=' + e.id + ' "' + e.name + '" type=' + e.type + ' B=' + e.asBuyer + ' S=' + e.asSupplier);
      for (const s of [...e.samplesBuyer, ...e.samplesSupplier]) console.log('    tx=' + s.id + ' ' + s.source_type + ' ' + s.source_url + ' amt=' + s.amount_eur + ' | ' + (s.description || '').slice(0, 70));
    }
  }
  fs.writeFileSync('.audit/WATCH145_notfound_impact.json', JSON.stringify(out, null, 2));
})();
