// WATCH #116 stráž STRÁNKA /upozornenia (READ-ONLY, nič nemení).
// Presne replikuje server-side logiku src/app/upozornenia/page.tsx:
//   1) paginovaný fetch transactions (.range cyklus, cap 1000 nesmie sa vrátiť)
//   2) dedup cez isDuplicatePublication (external_id z duplicate-ids.ts)
//   3) crzSuppliers = Set ICO z CRZ_CONTRACT (po dedup)
//   4) missingCrz = WEB_INVOICE s ICO NIE v crzSuppliers (suspicious)
//   5) over100k = amount_eur >= 100000
// Cieľ regresie: (a) 1000-cap sa nevrátil, (b) dedup drží (0 dup v over100k),
//   (c) 0 falošných "chýba v CRZ" (missingCrz), (d) NAJNOVŠIE over100k (Krtko cez
//   noc) — vyber na HTTP over proti CRZ realite v samostatnom kroku.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;

function loadExclusionSet() {
  const src = fs.readFileSync('src/lib/duplicate-ids.ts', 'utf8');
  const ids = src.match(/"crz_\d+"/g) || [];
  return new Set(ids.map(s => s.replace(/"/g, '')));
}

async function fetchAll() {
  const rows = [];
  let pages = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, source_url, date_published, created_at, supplier:supplier_entity_id(name, ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    pages++;
    if (data.length < PAGE) break;
  }
  return { rows, pages };
}

async function main() {
  const EXCL = loadExclusionSet();
  const { rows, pages } = await fetchAll();
  console.log('exclusion set =', EXCL.size, '| DB tx (paginated) =', rows.length, '| pages =', pages);
  if (rows.length <= 1000) console.log('!! POZOR: rows <= 1000 — over či cap alebo reálne toľko');

  // presne page.tsx: dedup HNEĎ po fetchi
  const deduped = rows.filter(t => !(t.external_id && EXCL.has(t.external_id)));
  console.log('po dedup =', deduped.length, '(odfiltrovaných', rows.length - deduped.length, ')');

  const crzSuppliers = new Set(
    deduped.filter(t => t.source_type === 'CRZ_CONTRACT' && t.supplier && t.supplier.ico).map(t => t.supplier.ico)
  );
  const enriched = deduped.map(t => {
    let suspicious = false;
    if (t.source_type === 'WEB_INVOICE' && t.supplier && t.supplier.ico && !crzSuppliers.has(t.supplier.ico)) suspicious = true;
    return { ...t, suspicious };
  });
  const missingCrz = enriched.filter(a => a.suspicious);
  const over100k = enriched.filter(a => (Number(a.amount_eur) || 0) >= 100000).sort((a, b) => (b.amount_eur || 0) - (a.amount_eur || 0));

  console.log('\n=== VÝSLEDOK (presne to čo /upozornenia zobrazuje) ===');
  console.log('crzSuppliers (distinct ICO) =', crzSuppliers.size);
  console.log('over100k =', over100k.length);
  console.log('missingCrz (faktúry bez CRZ) =', missingCrz.length);

  // REGRESIA A: dedup drží? žiadny nekanonický external_id v over100k
  const dupInOver = over100k.filter(t => t.external_id && EXCL.has(t.external_id));
  console.log('\n=== REGRESIA A: dedup v over100k ===');
  console.log('nekanonických duplikátov v over100k =', dupInOver.length, dupInOver.length === 0 ? 'OK' : '!! REGRESIA');

  // REGRESIA B: missingCrz rozbor — zoznam kto je označený "chýba v CRZ"
  console.log('\n=== REGRESIA B: missingCrz (falošné obvinenia?) ===');
  for (const m of missingCrz) {
    console.log(`  ${m.supplier?.ico||'?'} ${(m.supplier?.name||'').slice(0,40)}  ${(Number(m.amount_eur)||0).toFixed(2)}€  src=${m.source_type}`);
  }
  if (missingCrz.length === 0) console.log('  (žiadne — 0 obvinení)');

  // NAJNOVŠIE over100k (Krtko cez noc) na HTTP over
  const newestOver = [...over100k].filter(t => t.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15);
  console.log('\n=== NAJNOVŠIE over100k (created_at desc, top 15 — nočný Krtko vstup) ===');
  for (const t of newestOver) {
    console.log(`  ${t.external_id}  ${(Number(t.amount_eur)||0).toFixed(2)}€  ICO=${t.supplier?.ico||'?'} ${(t.supplier?.name||'').slice(0,32)}  created=${(t.created_at||'').slice(0,16)}`);
  }

  fs.writeFileSync('.audit/watch116_alerts.json', JSON.stringify({
    exclSize: EXCL.size, totalRows: rows.length, pages, deduped: deduped.length,
    crzSuppliers: crzSuppliers.size, over100k: over100k.length, missingCrz: missingCrz.length,
    dupInOver: dupInOver.map(t => t.external_id),
    missingCrzList: missingCrz.map(m => ({ ico: m.supplier?.ico, name: m.supplier?.name, amount: m.amount_eur, src: m.source_type })),
    newestOver: newestOver.map(t => ({ ext: t.external_id, amount: t.amount_eur, ico: t.supplier?.ico, name: t.supplier?.name, created: t.created_at, subject: (t.subject||'').slice(0,80) })),
    top10: over100k.slice(0, 10).map(t => ({ ext: t.external_id, amount: t.amount_eur, ico: t.supplier?.ico, name: t.supplier?.name })),
  }, null, 2));
  console.log('\n(uložené .audit/watch116_alerts.json)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
