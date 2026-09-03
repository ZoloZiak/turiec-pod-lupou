// READ-ONLY: full-DB (paginated) matching slub -> realne CRZ zmluvy.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchAll() {
  let all = [], from = 0, page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, subject, amount_eur, source_url, source_type, date_published')
      .range(from, from + page - 1);
    if (error) { console.log('ERR', error.message); break; }
    all = all.concat(data || []);
    if (!data || data.length < page) break;
    from += page;
  }
  return all;
}

async function run() {
  const all = await fetchAll();
  console.log(`Nacitanych tx: ${all.length}`);
  const { data: promises } = await supabase.from('promises').select('*').order('created_at');

  // presnejsie temy: kazdy slub ma vlastny matcher (title -> regex)
  const M = {
    'Výstavba akvaparku / kúpaliska': /akvapark|kupalisk|bazen|plavár|plaven|wellness/i,
    'Bezplatná MHD': /mestsk.{0,3}(hromadn|autobus)|\bMHD\b|dopravn.{0,3}podnik|DPMM|verejnom z\u00e1ujme.{0,20}doprav/i,
    'Parkovacia politika (Parkovacie domy)': /parkovac|parkovan|parkov\u00fd dom/i,
    'Výstavba Univerzitnej nemocnice': /univerzitn.{0,3}nemocnic|nov\u00e1 nemocnica|UNM|Plán obnovy.{0,20}nemocnic/i,
    'Lanovka na Martinské hole': /lanov|Martinsk\u00e9 hole|lyžiarsk/i,
    'Zníženie dlhu mesta': /\búver\b|\búveru\b|dlhopis|konsolid|splátk.{0,10}istin|refinanc/i,
    'Oprava ciest a chodníkov': /oprav.{0,15}ciest|rekonštrukci.{0,15}ciest|chodník|asfalt|komunikáci|recykl/i,
    'Výstavba domovov pre seniorov': /senior|domov.{0,10}dôchodc|zariaden.{0,15}soci|opatrovate/i,
    'Nové parkovacie miesta': /parkovac.{0,3}miest|parkov/i,
    'Transparentnejšie obstarávanie': /transparent|elektronick.{0,10}(aukci|obstaráv)|zverejňovan/i,
    'Zelenšie mesto a údržba parkov': /revitaliz.{0,10}park|zazelen|zeleň|kosen|výsadb|stromoradi|park P\. O\./i,
  };

  for (const p of (promises||[])) {
    const re = M[p.title];
    console.log(`\n######## ${p.title}  [${p.status}] src=${p.source_url}`);
    if (!re) { console.log('  (ziadny matcher)'); continue; }
    const hits = all.filter(t => t.subject && re.test(t.subject));
    const top = hits.sort((a,b)=>(Number(b.amount_eur)||0)-(Number(a.amount_eur)||0)).slice(0,8);
    console.log(`  celkom ${hits.length} kandidatov, top:`);
    for (const h of top) console.log(`   ${h.id} | ${(Number(h.amount_eur)||0).toLocaleString('sk')} EUR | ${h.date_published} | ${(h.subject||'').replace(/&quot;/g,'"').slice(0,90)}`);
  }
}
run().catch(e=>console.log('FATAL',e.message));
