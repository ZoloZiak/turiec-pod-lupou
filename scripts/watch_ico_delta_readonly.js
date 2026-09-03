// READ-ONLY WATCH IČO delta: distinct entities.ico v ŽIVEJ DB vs .audit/watch_ico_live_set.json
// Cieľ: chytiť NOVÉ IČO ktoré Krtko cez noc pridal a nie sú v audit-sete (regresia = neoverené IČO).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SETPATH = '.audit/watch_ico_live_set.json';

(async () => {
  const set = JSON.parse(fs.readFileSync(SETPATH, 'utf8'));
  const setIcos = new Set(set.items.map(i => String(i.ico)));

  // distinct entities.ico z DB (paginované)
  const dbIcos = new Map(); // ico -> name
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('entities').select('ico,name').range(from, from + PAGE - 1);
    if (error) { console.log('ERR entities: ' + error.message); process.exit(1); }
    for (const e of data) { if (e.ico) dbIcos.set(String(e.ico), e.name); }
    if (data.length < PAGE) break;
  }
  console.log('DB distinct entities.ico: ' + dbIcos.size + ' | set: ' + setIcos.size);

  const onlyDb = [...dbIcos.keys()].filter(i => !setIcos.has(i)).map(i => ({ ico: i, name: dbIcos.get(i) }));
  const onlySet = [...setIcos].filter(i => !dbIcos.has(i));

  console.log('\n== NOVÉ v DB, NIE v sete (' + onlyDb.length + ') ==');
  for (const e of onlyDb) console.log(e.ico + ' | ' + e.name);
  console.log('\n== v sete, NIE v DB (' + onlySet.length + ') ==');
  for (const i of onlySet) console.log(i);

  fs.writeFileSync('.audit/WATCH_ico_delta_result.json', JSON.stringify({ dbCount: dbIcos.size, setCount: setIcos.size, onlyDb, onlySet }, null, 2));
})();
