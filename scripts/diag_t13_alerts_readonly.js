// T13: READ-ONLY overenie /upozornenia (AlertsPage).
// src/app/upozornenia/page.tsx robi supabase.from('transactions').select(...) BEZ .range()
// -> Supabase default limit 1000. DB ma ~2223 tx => stranka pocita crzSuppliers set,
// missingCrz aj over100k len z PRVYCH 1000 riadkov (bez explicitneho order = nedefinovane
// poradie). Dosledok: WEB_INVOICE dodavatel, ktoreho CRZ zmluva je v neprecitanych riadkoch,
// bude FALOSNE oznaceny "Faktura bez zmluvy v CRZ" (obvinenie nad menovanym subjektom!).
// Tento skript: 1) exact count, 2) API-style (select bez range) presne ako page.tsx vs
// plna pravda (paginovany fetch), 3) porovna velkost crzSuppliers setu, missingCrz a over100k,
// 4) vypise dodavatelov, ktori su FALOSNE v missingCrz kvoli capu. Nic nemeni.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;

const SELECT = `
  *,
  supplier:entities!transactions_supplier_entity_id_fkey(ico, name),
  buyer:entities!transactions_buyer_entity_id_fkey(name)
`;

// presne to, co robi page.tsx: jeden select, bez range -> default cap 1000
async function apiStyle() {
  const { data, error } = await supabase.from('transactions').select(SELECT);
  if (error) throw error;
  return data || [];
}

// plny paginovany fetch (pravda)
async function truthStyle() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select(SELECT)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

function analyze(txs) {
  const crzSuppliers = new Set(
    txs.filter(t => t.source_type === 'CRZ_CONTRACT' && t.supplier && t.supplier.ico)
       .map(t => t.supplier.ico)
  );
  const missingCrz = txs.filter(t =>
    t.source_type === 'WEB_INVOICE' && t.supplier && t.supplier.ico && !crzSuppliers.has(t.supplier.ico)
  );
  const over100k = txs.filter(t => (t.amount_eur || 0) >= 100000);
  return { crzSuppliers, missingCrz, over100k };
}

async function main() {
  console.log('=== T13 /upozornenia alerts audit (READ-ONLY) ===');
  const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log('transactions COUNT (exact) = ' + count);

  const api = await apiStyle();
  const truth = await truthStyle();
  console.log(`API-style (page.tsx, bez range) nacitalo: ${api.length} riadkov`);
  console.log(`PRAVDA (paginovany fetch) nacitalo:       ${truth.length} riadkov`);
  console.log(`CAP AKTIVNY: ${api.length < truth.length ? 'ANO - page.tsx vidi len ' + api.length + '/' + truth.length : 'nie'}`);

  const a = analyze(api);
  const t = analyze(truth);
  console.log('--- POROVNANIE ---');
  console.log(`crzSuppliers set:  API=${a.crzSuppliers.size}  PRAVDA=${t.crzSuppliers.size}`);
  console.log(`missingCrz (faktury bez CRZ): API=${a.missingCrz.length}  PRAVDA=${t.missingCrz.length}`);
  console.log(`over100k: API=${a.over100k.length}  PRAVDA=${t.over100k.length}`);

  // Falosne obvinenia: dodavatelia v API.missingCrz, ktori v PRAVDE NIE su missing
  // (t.j. ich CRZ zmluva existuje, len v neprecitanych riadkoch)
  const truthMissingIcos = new Set(t.missingCrz.map(x => x.supplier.ico));
  const falsePositives = a.missingCrz.filter(x => !truthMissingIcos.has(x.supplier.ico));
  const fpByIco = {};
  for (const x of falsePositives) {
    const ico = x.supplier.ico;
    if (!fpByIco[ico]) fpByIco[ico] = { name: x.supplier.name, count: 0 };
    fpByIco[ico].count++;
  }
  console.log('--- FALOSNE "chyba v CRZ" obvinenia (API oznaci, ale CRZ zmluva realne existuje) ---');
  const fpEntries = Object.entries(fpByIco);
  if (fpEntries.length === 0) {
    console.log('  ZIADNE (cap nespôsobuje falosne obvinenie)');
  } else {
    for (const [ico, info] of fpEntries) {
      console.log(`  ico=${ico} | ${info.name} | falosne oznacenych faktur: ${info.count}`);
    }
    console.log(`SPOLU falosne obvinenych dodavatelov: ${fpEntries.length}`);
  }

  // Opacne: dodavatelia ktorych PRAVDA oznaci ako missing ale API nie (chybajuce upozornenia)
  const apiMissingIcos = new Set(a.missingCrz.map(x => x.supplier.ico));
  const missedIcos = [...truthMissingIcos].filter(ico => !apiMissingIcos.has(ico));
  console.log(`--- ZMESKANE upozornenia (PRAVDA missing, API nezobrazi): ${missedIcos.length} dodavatelov ---`);

  console.log('=== koniec ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
