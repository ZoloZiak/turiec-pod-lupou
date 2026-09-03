// READ-ONLY: pre kazdy promise najdi kandidatske REALNE transakcie (keyword ILIKE na subject).
// Nic nemeni. Podklad na rucne prepojenie related_transaction_ids.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// mapovanie promise title -> kandidatske keywordy (ILIKE OR)
const MAP = {
  'akvapark': ['akvapark','kúpalisk','kupalisk','plaváreň','plavaren','bazén','bazen'],
  'MHD': ['MHD','autobus','dopravný podnik','dopravny podnik','DPMM','trolejbus','mestská doprava'],
  'Parkovacia politika': ['parkov'],
  'Univerzitnej nemocnice': ['nemocnic','UNM','univerzitná nemocnica'],
  'Lanovka': ['lanovk','Martinské hole','Martinske hole','vlek'],
  'dlhu mesta': ['úver','uver','dlh','konsolidác','splátka istiny','banka','ČSOB','VÚB','Slovenská sporiteľňa'],
  'ciest a chodníkov': ['cest','chodník','chodnik','asfalt','komunikác','rekonštrukcia ulice','oprava mostu','výtlk'],
  'domovov pre seniorov': ['senior','domov dôchodcov','domov dochodcov','ZpS','zariadenie pre seniorov','sociáln'],
  'Nové parkovacie miesta': ['parkov'],
  'Transparentnejšie obstarávanie': ['elektronick','softvér','softver','portál','informačný systém','IS ','licencia','ESO','egov'],
  'Zelenšie mesto': ['kosen','park','zeleň','zelen','revitalizác','výsadb','vysadb','stromy','údržba zelene'],
};

async function run() {
  const { data: promises } = await supabase.from('promises').select('*').order('created_at');
  for (const p of promises) {
    // najdi klucovy set podla substringu v title
    let keys = null;
    for (const k of Object.keys(MAP)) { if (p.title.includes(k)) { keys = MAP[k]; break; } }
    console.log(`\n### ${p.title}  [${p.status}]  linked=${(p.related_transaction_ids||[]).length}`);
    if (!keys) { console.log('  (ziadne keywordy namapovane)'); continue; }
    const seen = new Set();
    for (const kw of keys) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, subject, amount_eur, source_url, source_type, date_published')
        .ilike('subject', `%${kw}%`)
        .order('amount_eur', { ascending: false })
        .limit(8);
      if (error) { console.log(`  [${kw}] CHYBA ${error.message}`); continue; }
      for (const t of (data||[])) {
        if (seen.has(t.id)) continue; seen.add(t.id);
        const amt = t.amount_eur != null ? Math.round(t.amount_eur) : '?';
        console.log(`  [${kw}] ${amt}€ | ${(t.subject||'').slice(0,90)} | ${t.id}`);
      }
    }
    if (seen.size === 0) console.log('  (ziadna zhoda v transactions)');
  }
}
run().catch(e => console.log('FATAL', e.message));
