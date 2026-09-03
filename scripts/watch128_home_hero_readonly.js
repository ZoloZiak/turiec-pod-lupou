// WATCH #128 (STRÁŽ STRÁNKA, cursor=127) — READ-ONLY re-verifikácia HOME hero agregátu.
// Presná replikácia src/app/api/data/route.ts proti ŽIVEJ DB, aby chytila regresiu po
// nočnom Krtko batch-i. Nič nemení. INCOME/DUPLICATE ID číta zo zdrojákov (auditovateľné).
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // BrainRocket MITM

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  const body = src.slice(src.indexOf('new Set<string>(['));
  return new Set(body.match(UUID_RE) || []);
}
function loadDuplicateExtIds() {
  const src = fs.readFileSync('src/lib/duplicate-ids.ts', 'utf8');
  const ids = new Set();
  const re = /"(crz_\d+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) ids.add(m[1]);
  return ids;
}

async function main() {
  console.log('=== WATCH #128 HOME hero re-verify (READ-ONLY) ===');
  const INCOME = loadIncomeIds();
  const DUP = loadDuplicateExtIds();
  console.log(`INCOME_TX_IDS zo zdrojáku: ${INCOME.size}`);
  console.log(`DUPLICATE ext_id zo zdrojáku: ${DUP.size}`);

  // exact count
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log('transactions COUNT (exact) = ' + txCount);

  // detekcia direction stlpca (ako route)
  const { error: dirProbeError } = await supabase.from('transactions').select('direction').limit(1);
  const dirMsg = (dirProbeError?.message || '').toLowerCase();
  const hasDirectionColumn = !(dirProbeError && dirMsg.includes('column') && dirMsg.includes('direction'));
  console.log('hasDirectionColumn = ' + hasDirectionColumn);

  // full paginovany fetch (pravda)
  const cols = hasDirectionColumn
    ? 'id, external_id, source_type, amount_eur, direction'
    : 'id, external_id, source_type, amount_eur';
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions').select(cols)
      .order('date_published', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`Full fetch: ${rows.length} riadkov (cap check: ${rows.length === txCount ? 'OK, všetko' : 'POZOR nesedí s count'})`);

  // dedup (route: filter isDuplicatePublication)
  const deduped = rows.filter(t => !DUP.has(t.external_id));
  console.log(`Po dedupe: ${deduped.length} (vylúčených ${rows.length - deduped.length}, očakávam ${DUP.size})`);

  // agregácia hero
  let totalSpent = 0, totalIncome = 0, expenseCount = 0, incomeCount = 0;
  let nanCount = 0, negCount = 0;
  for (const t of deduped) {
    const raw = t.amount_eur;
    const amt = Number(raw) || 0;
    if (raw !== null && raw !== undefined && isNaN(Number(raw))) nanCount++;
    if (amt < 0) negCount++;
    const is_income = (hasDirectionColumn && t.direction) ? t.direction === 'INCOME' : INCOME.has(t.id);
    if (is_income) { totalIncome += amt; incomeCount++; }
    else { totalSpent += amt; expenseCount++; }
  }

  // entities count (ako route)
  const { data: entities } = await supabase.from('entities').select('ico').eq('type', 'MUNICIPALITY').neq('ico', '99999999');
  const entitiesCount = (entities || []).length;

  console.log('--- HERO STATS (replikácia route.ts) ---');
  console.log(`totalSpent      = ${totalSpent.toFixed(2)} EUR  (${expenseCount} tx = totalContracts)`);
  console.log(`totalIncome     = ${totalIncome.toFixed(2)} EUR  (${incomeCount} tx = incomeCount)`);
  console.log(`entitiesCount   = ${entitiesCount}`);
  console.log(`NaN amount_eur  = ${nanCount}  |  záporné sumy = ${negCount}`);

  // sanity dvojite pocitanie
  const sumAll = deduped.reduce((a, t) => a + (Number(t.amount_eur) || 0), 0);
  const recomposed = totalSpent + totalIncome;
  console.log('--- SANITY ---');
  console.log(`sum(deduped amount)      = ${sumAll.toFixed(2)}`);
  console.log(`totalSpent+totalIncome   = ${recomposed.toFixed(2)}  ${Math.abs(sumAll - recomposed) < 0.01 ? '=> OK (žiadny prekryv)' : '=> POZOR nesedí'}`);

  const out = {
    ts: new Date().toISOString(), txCount, fetched: rows.length, capOk: rows.length === txCount,
    hasDirectionColumn, incomeIdsSize: INCOME.size, dupSize: DUP.size, dedupedExcluded: rows.length - deduped.length,
    totalSpent: +totalSpent.toFixed(2), totalIncome: +totalIncome.toFixed(2), totalContracts: expenseCount,
    incomeCount, entitiesCount, nanCount, negCount, sanityOk: Math.abs(sumAll - recomposed) < 0.01,
  };
  fs.writeFileSync('.audit/watch128_home_hero_result.json', JSON.stringify(out, null, 2));
  console.log('=== koniec WATCH #128 ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
