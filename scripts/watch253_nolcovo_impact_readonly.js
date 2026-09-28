// READ-ONLY WATCH #253: dopad Obec Nolčovo entity s CHYBNÝM IČO "00216822".
// Reálne IČO = 00316822 (RPO exact + CRZ + RÚZ). Zisti: entitu(y) s 00216822,
// koľko tx na ňu visí (supplier/buyer), a či už existuje entita s 00316822 (kolízia
// -> merge namiesto update). NIČ nemení.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BAD = '00216822';
const GOOD = '00316822';

(async () => {
  // 1) entity s chybným IČO
  const { data: badEnts, error: e1 } = await sb.from('entities').select('id, ico, name').eq('ico', BAD);
  if (e1) { console.error('ent err', e1.message); process.exit(1); }
  console.log('== entity s CHYBNÝM IČO ' + BAD + ' ==');
  for (const e of badEnts) console.log(JSON.stringify(e));

  // 2) entity so správnym IČO (kolízia?)
  const { data: goodEnts } = await sb.from('entities').select('id, ico, name').eq('ico', GOOD);
  console.log('== entity so SPRÁVNYM IČO ' + GOOD + ' (kolízia ak >0) ==');
  for (const e of (goodEnts || [])) console.log(JSON.stringify(e));

  // 3) entity s názvom obsahujúcim Nolčovo (kontrola duplikátov/orphanov)
  const { data: nameEnts } = await sb.from('entities').select('id, ico, name').ilike('name', '%Nolčovo%');
  console.log('== entity s názvom %Nolčovo% ==');
  for (const e of (nameEnts || [])) console.log(JSON.stringify(e));

  // 4) tx dopad pre chybnú entitu
  for (const e of badEnts) {
    const { count: cSup } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_id', e.id);
    const { count: cBuy } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('buyer_id', e.id);
    console.log(`ent id=${e.id} ico="${e.ico}" name="${e.name}" -> supplier_tx=${cSup} buyer_tx=${cBuy}`);
    const { data: sample } = await sb.from('transactions')
      .select('id, ext_id, amount_eur, description, source_url')
      .or(`supplier_id.eq.${e.id},buyer_id.eq.${e.id}`).limit(5);
    for (const t of (sample || [])) console.log('   tx', JSON.stringify(t));
  }
})().catch(e => console.log('FATAL: ' + e.message));
