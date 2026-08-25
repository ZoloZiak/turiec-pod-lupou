// T12: READ-ONLY overenie /dodavatel/[ico] agregatu.
// API /api/supplier robi .select().eq('supplier_entity_id').order() BEZ .range() ->
// Supabase default limit 1000 => ak dodavatel ma >1000 transakcii, totalAmount aj
// totalCount su PODHODNOTENE (rovnaky typ bugu ako T01 hero).
// Tento skript: 1) zisti top dodavatelov podla poctu tx (cez paginovany fetch),
// 2) pre top N realnych ICO porovna API-style (limit 1000, bez range) vs plny
// paginovany sucet (range cyklus) — ak sa lisia, bug potvrdeny.
// 3) over NaN-guard (Number(amount)||0) a chartData rozdelenie po rokoch.
// Nic nemeni.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;

async function fetchAllTx(cols, filterFn) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('transactions').select(cols).order('date_published', { ascending: false });
    if (filterFn) q = filterFn(q);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// simuluje presne to, co robi API route (jeden select, bez range -> default cap 1000)
async function apiStyle(supplierId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount_eur, date_published')
    .eq('supplier_entity_id', supplierId)
    .order('date_published', { ascending: false });
  if (error) throw error;
  let totalAmount = 0;
  const yv = {};
  (data || []).forEach(t => {
    const a = Number(t.amount_eur) || 0;
    totalAmount += a;
    const y = new Date(t.date_published).getFullYear().toString();
    yv[y] = (yv[y] || 0) + a;
  });
  return { totalAmount, totalCount: (data || []).length, chartYears: Object.keys(yv).sort() };
}

// plny paginovany sucet (pravda)
async function truthStyle(supplierId) {
  const rows = await fetchAllTx('id, amount_eur, date_published', q => q.eq('supplier_entity_id', supplierId));
  let totalAmount = 0;
  const yv = {};
  rows.forEach(t => {
    const a = Number(t.amount_eur) || 0;
    totalAmount += a;
    const y = new Date(t.date_published).getFullYear().toString();
    yv[y] = (yv[y] || 0) + a;
  });
  return { totalAmount, totalCount: rows.length, chartYears: Object.keys(yv).sort() };
}

async function main() {
  console.log('=== T12 supplier agregat audit (READ-ONLY) ===');
  // 1) total tx count
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log('transactions COUNT (exact) = ' + txCount);

  // 2) zisti pocty per supplier cez paginovany fetch (len supplier_entity_id)
  const all = await fetchAllTx('supplier_entity_id');
  const perSup = {};
  let nullSup = 0;
  for (const r of all) {
    if (!r.supplier_entity_id) { nullSup++; continue; }
    perSup[r.supplier_entity_id] = (perSup[r.supplier_entity_id] || 0) + 1;
  }
  console.log('nacitanych tx riadkov: ' + all.length + ', bez supplier_entity_id: ' + nullSup);
  const top = Object.entries(perSup).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('--- TOP 12 dodavatelov podla poctu tx ---');
  const overCap = top.filter(([, c]) => c > PAGE);
  for (const [sid, c] of top) {
    const { data: ent } = await supabase.from('entities').select('name, ico').eq('id', sid).single();
    const flag = c > PAGE ? '  <<< NAD 1000 - API PODHODNOTI' : '';
    console.log(`  ${c} tx | ico=${ent?.ico} | ${ent?.name}${flag}`);
  }
  console.log('dodavatelov nad 1000 tx: ' + overCap.length);

  // 3) pre top 5 realnych ICO: API-style vs pravda
  console.log('--- POROVNANIE API-style (bez range) vs plna pravda (range cyklus) ---');
  let mismatches = 0;
  for (const [sid, c] of top.slice(0, 8)) {
    const { data: ent } = await supabase.from('entities').select('name, ico').eq('id', sid).single();
    const a = await apiStyle(sid);
    const t = await truthStyle(sid);
    const diffAmt = Math.round((t.totalAmount - a.totalAmount) * 100) / 100;
    const ok = a.totalCount === t.totalCount && Math.abs(diffAmt) < 0.01;
    if (!ok) mismatches++;
    console.log(`  ico=${ent?.ico} ${ent?.name}`);
    console.log(`    API:   count=${a.totalCount} amount=${a.totalAmount.toFixed(2)}`);
    console.log(`    PRAVDA:count=${t.totalCount} amount=${t.totalAmount.toFixed(2)}  diff_amount=${diffAmt}  ${ok ? 'OK' : '*** MISMATCH ***'}`);
  }
  console.log('MISMATCHOV (API != pravda): ' + mismatches);
  console.log('=== koniec ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
