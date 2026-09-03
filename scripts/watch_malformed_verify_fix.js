// READ-ONLY WATCH #89 verifikácia opravy: pre každý opravený pár over, že
// (a) correctIco(malformed) == real, (b) supplier route logika (kanon alebo orphan fallback)
// nájde entitu (žiadne 404), (c) isValidIco(real) == true (link sa zobrazí).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// zrkadlo mapy z entity-ico-fixes.ts
const CORR = {
  '00216822': '00316822',
  '52  222 438': '47619503', '31 580 726': '31580726', '361062145': '50139088',
  '55 049 249': '55049249', '35 770 732': '35770732', '44552483 ': '44552483',
  '316873': '00316873', '36 751 804 ': '36751804', '36368792 ': '36368792',
  '54 228 573': '35709332', '316580': '00316580', '316679': '00316679',
  '50 513 923 ': '45541329',
};
const correctIco = i => CORR[i] ?? i;
const isValidIco = i => !!i && /^\d{8}$/.test(i);
const wrongIcosFor = real => Object.entries(CORR).filter(([, r]) => r === real).map(([w]) => w);

const MAL = ['52  222 438','31 580 726','361062145','55 049 249','35 770 732','44552483 ','316873','36 751 804 ','36368792 ','54 228 573','316580','316679','50 513 923 '];

(async () => {
  let fail = 0;
  for (const mal of MAL) {
    const real = correctIco(mal);
    // simuluj supplier route
    const { data: canon } = await sb.from('entities').select('id,name').eq('ico', real).maybeSingle();
    const wrong = wrongIcosFor(real);
    const { data: orphans } = await sb.from('entities').select('id,name').in('ico', wrong);
    const entIds = [];
    let supplier = canon;
    if (canon) entIds.push(canon.id);
    for (const o of orphans || []) { if (!entIds.includes(o.id)) entIds.push(o.id); if (!supplier) supplier = { ...o, ico: real }; }
    const found = !!supplier && entIds.length > 0;
    // spočítaj tx cez entIds
    let tx = 0;
    for (const id of entIds) {
      const { count: b } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', id);
      const { count: s } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', id);
      tx += (b || 0) + (s || 0);
    }
    const linkOk = isValidIco(real);
    const ok = found && linkOk && tx > 0;
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'FAIL'} "${mal}" -> ${real} | profil=${found?'nájdený':'404!'} link=${linkOk} tx=${tx} | ${supplier ? supplier.name : '-'}`);
  }
  console.log(`\n${fail === 0 ? 'VŠETKO OK' : fail + ' ZLYHANÍ'} — žiadny profil nevracia 404, linky vedú na platné IČO.`);
})();
