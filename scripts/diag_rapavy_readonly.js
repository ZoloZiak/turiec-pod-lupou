// READ-ONLY: presny pocet + rozsah Rapavy Peter mis-atribucie.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: ents } = await supabase.from('entities').select('id, name, ico').ilike('name', '%Rapav%');
  const entIds = ents.map(e => e.id);
  console.log('RAPAVY ENTITY (' + ents.length + '):');
  for (const en of ents) console.log(`  ${en.ico}  ${en.id}`);

  // presny count buyer
  const { count: cBuy } = await supabase.from('transactions').select('id', {count:'exact', head:true}).in('buyer_entity_id', entIds);
  const { count: cSup } = await supabase.from('transactions').select('id', {count:'exact', head:true}).in('supplier_entity_id', entIds);
  console.log(`\nPOCET tx: buyer=${cBuy}  supplier=${cSup}`);

  // paginovany sucet buyer + rozdelenie nenulovych
  let from=0, sumBuy=0, nonzero=[];
  while(true){
    const { data } = await supabase.from('transactions').select('external_id, amount_eur, subject').in('buyer_entity_id', entIds).range(from, from+999);
    if(!data || !data.length) break;
    for(const t of data){ const a=Number(t.amount_eur)||0; sumBuy+=a; if(a>0) nonzero.push({e:t.external_id,a,s:(t.subject||'').slice(0,55)}); }
    if(data.length<1000) break; from+=1000;
  }
  console.log(`\nBUYER sucet vsetkych: ${sumBuy.toFixed(2)} EUR`);
  console.log(`Nenulovych zmluv: ${nonzero.length}`);
  nonzero.sort((a,b)=>b.a-a.a);
  for(const t of nonzero) console.log(`  ${t.e} | ${t.a} EUR | ${t.s}`);

  // ake ine entity by mohli byt spravne? over ci existuje uz Turcianska vodarenska ako entita
  const { data: tvs } = await supabase.from('entities').select('id, name, ico').or('ico.eq.36672084,name.ilike.%odárensk%');
  console.log('\nTURCIANSKA VODARENSKA entita v DB:');
  for (const en of (tvs||[])) console.log(`  ${en.ico}  ${en.id}  "${en.name}"`);
}
run().catch(e => console.log('FATAL: ' + e.message));
