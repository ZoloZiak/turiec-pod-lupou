// READ-ONLY: zbiera distinct ICO (dodavatel + odberatel) z transactions do .audit/DV-ICO-ALL_set.json
// Nic nemeni. Pouzitie: node scripts/dv_ico_collect_readonly.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) { console.error('Chybaju Supabase kluce!'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  const map = new Map(); // ico -> {ico, name, roles:Set}
  let txCount = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('id,supplier_entity_id,buyer_entity_id,supplier:supplier_entity_id(name,ico),buyer:buyer_entity_id(name,ico)')
      .range(from, from + PAGE - 1);
    if (error) { console.error('DB chyba:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    txCount += data.length;
    for (const r of data) {
      const pairs = [
        [r.supplier && r.supplier.ico, r.supplier && r.supplier.name, 'dodavatel'],
        [r.buyer && r.buyer.ico, r.buyer && r.buyer.name, 'odberatel'],
      ];
      for (const [ico, name, role] of pairs) {
        if (!ico || !/^\d{8}$/.test(String(ico))) continue;
        const key = String(ico);
        if (!map.has(key)) map.set(key, { ico: key, name: name || null, roles: new Set() });
        const e = map.get(key);
        e.roles.add(role);
        if (name && (!e.name || e.name.startsWith('NEZNAMY'))) e.name = name;
      }
    }
    if (data.length < PAGE) break;
  }
  const list = [...map.values()].map(e => ({ ico: e.ico, name: e.name, roles: [...e.roles] }));
  list.sort((a, b) => a.ico.localeCompare(b.ico));
  fs.writeFileSync('.audit/DV-ICO-ALL_set.json', JSON.stringify({ generated: new Date().toISOString(), txCount, total: list.length, items: list }, null, 2));
  console.log(`transakcii: ${txCount}, distinct validnych ICO: ${list.length} -> .audit/DV-ICO-ALL_set.json`);
})();
