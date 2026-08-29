// READ-ONLY: export eu_funds obsahu z DB do idempotentneho SQL seedu.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const q = s => s==null ? 'NULL' : `'${String(s).replace(/'/g,"''")}'`;
async function run(){
  const { data } = await supabase.from('eu_funds').select('*').order('amount_eur',{ascending:false});
  let out = `-- AUTO-GENEROVANE z eu_funds (scripts/etl_eu_funds_from_tx.js). ${data.length} realnych NFP dotacii.\n`;
  out += `-- Zdroj: transactions (CRZ zmluvy o poskytnuti NFP), prijimatel = Martin/DPMM/TVS.\n`;
  out += `-- Idempotentne: wipe + reinsert. Spustit v Supabase SQL Editor.\n\n`;
  out += `DELETE FROM eu_funds;\n\nINSERT INTO eu_funds (project_name, amount_eur, program_name, year, winner_ico, winner_name) VALUES\n`;
  const vals = data.map(r=>`(${q(r.project_name)}, ${Number(r.amount_eur)}, ${q(r.program_name)}, ${r.year==null?'NULL':r.year}, ${q(r.winner_ico)}, ${q(r.winner_name)})`);
  out += vals.join(',\n') + ';\n';
  fs.writeFileSync('database/04_eu_funds_seed.sql', out);
  console.log(`Zapisanych ${data.length} riadkov do database/04_eu_funds_seed.sql`);
}
run().catch(e=>console.log('FATAL',e.message));
