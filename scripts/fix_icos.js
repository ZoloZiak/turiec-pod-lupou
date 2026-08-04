const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function getIco(name) {
    try {
        const res = await fetch(`https://finstat.sk/hladaj?Query=${encodeURIComponent(name)}`, { redirect: 'manual' });
        // Finstat redirects to the company page if there's an exact match: /31578861
        const location = res.headers.get('location');
        if (location && location.match(/^\/\d{8}$/)) {
            return location.substring(1);
        }
        return null;
    } catch (e) {
        return null;
    }
}

(async () => {
  const { data } = await supabase.from('transactions')
    .select('supplier_entity_id, amount_eur, supplier:supplier_entity_id(name, ico)')
    .gte('amount_eur', 100000);
  
  const missing = data.filter(t => t.supplier && t.supplier.ico && t.supplier.ico.startsWith('NO_ICO_'));
  
  const uniqueMissing = {};
  for (const t of missing) {
      if (!uniqueMissing[t.supplier_entity_id]) {
          uniqueMissing[t.supplier_entity_id] = t.supplier.name;
      }
  }

  for (const [id, name] of Object.entries(uniqueMissing)) {
      console.log(`Checking ${name}...`);
      // clean up name for search
      let cleanName = name.replace(/&quot;/g, '"');
      const ico = await getIco(cleanName);
      if (ico) {
          console.log(`Found IČO for ${name}: ${ico}. Updating...`);
          await supabase.from('entities').update({ ico: ico }).eq('id', id);
      } else {
          console.log(`Could not auto-find IČO for ${name}`);
      }
      await new Promise(r => setTimeout(r, 1000));
  }
})();
