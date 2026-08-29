// READ-ONLY: export city_council_votes do idempotentneho SQL seedu (davkovane).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const q = s => s==null ? 'NULL' : `'${String(s).replace(/'/g,"''")}'`;
async function run(){
  // PostgREST strop 1000 -> stránkujeme
  let data = [];
  for(let from=0;;from+=1000){
    const { data: chunk, error } = await supabase.from('city_council_votes').select('*').order('vote_date',{ascending:true}).order('issue_title',{ascending:true}).order('councillor_name',{ascending:true}).range(from, from+999);
    if(error){ console.log('ERR',error.message); return; }
    data = data.concat(chunk);
    if(chunk.length < 1000) break;
  }
  let out = `-- AUTO-GENEROVANE z city_council_votes (scripts/etl_council_votes.py). ${data.length} zaznamov.\n`;
  out += `-- Menovite hlasovania MsZ Martin (system H.E.R.), krizovo overene voci suctom v PDF.\n`;
  out += `-- Zasadnutia 2026: 29.01, 19.02, 26.03. Zdroj: martin.sk. Idempotentne: wipe + reinsert.\n\n`;
  out += `DELETE FROM city_council_votes;\n\n`;
  const cols = 'councillor_name, district, vote_cast, issue_title, vote_date, source_url';
  for(let i=0;i<data.length;i+=200){
    const batch = data.slice(i,i+200);
    out += `INSERT INTO city_council_votes (${cols}) VALUES\n`;
    out += batch.map(r=>`(${q(r.councillor_name)}, ${q(r.district)}, ${q(r.vote_cast)}, ${q(r.issue_title)}, ${q(r.vote_date)}, ${q(r.source_url)})`).join(',\n') + ';\n\n';
  }
  fs.writeFileSync('database/06_council_votes_seed.sql', out);
  console.log(`Zapisanych ${data.length} riadkov do database/06_council_votes_seed.sql`);
}
run().catch(e=>console.log('FATAL',e.message));
