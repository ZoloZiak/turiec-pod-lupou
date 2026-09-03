// READ-ONLY: zbiera zmluvy nad 100k EUR (amount_eur >= 100000) do .audit/T04_over100k_set.json
// Nic nemeni. Pouzitie: node scripts/dv_t04_collect_over100k_readonly.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) { console.error('Chybaju Supabase kluce!'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('id,amount_eur,subject,source_type,source_url,date_published,supplier:supplier_entity_id(name,ico)')
      .gte('amount_eur', 100000)
      .order('amount_eur', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { console.error('DB chyba:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data) {
      rows.push({
        id: r.id,
        amount_eur: r.amount_eur,
        subject: r.subject,
        source_type: r.source_type,
        source_url: r.source_url,
        date_published: r.date_published,
        ico: r.supplier && r.supplier.ico,
        name: r.supplier && r.supplier.name,
      });
    }
    if (data.length < PAGE) break;
  }
  // distinct ICO medzi nad-100k zmluvami
  const icoSet = new Set(rows.map(r => r.ico).filter(x => x && /^\d{8}$/.test(String(x))));
  fs.writeFileSync('.audit/T04_over100k_set.json', JSON.stringify({
    generated: new Date().toISOString(),
    total_rows: rows.length,
    distinct_icos: icoSet.size,
    items: rows,
  }, null, 2));
  console.log(`nad-100k zmluv: ${rows.length}, distinct validnych ICO: ${icoSet.size} -> .audit/T04_over100k_set.json`);
})();
