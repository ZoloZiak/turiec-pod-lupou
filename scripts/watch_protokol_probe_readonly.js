// WATCH stráž READ-ONLY: prešetri konkrétny #66 hand-off "Protokol o odovzdaní majetku"
// (Správa športových zariadení) 2,13M/999k a všeobecne CRZ zmluvy s vysokou sumou, ktoré sa
// v subjekte opakujú viackrát (potenciálna expense double-publikácia mimo NFP).
// Nič nemení. Vypíše skupiny podľa (normSubject + buyer_ico + supplier_ico) BEZ amount,
// aby odhalilo aj páry s rôznou sumou (2,13M vs 999k) — tie potom over ručne v CRZ.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)')
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}
async function main() {
  const rows = await fetchAll();
  const crz = rows.filter(r => r.source_type === 'CRZ_CONTRACT');

  // (1) priamo "Protokol o odovzdaní"
  console.log('=== "Protokol o odovzdani" zmluvy ===');
  const prot = crz.filter(r => norm(r.subject).includes('protokoloodovzdani'));
  for (const r of prot) console.log(`  ${r.external_id} amt=${(Number(r.amount_eur)||0).toFixed(2)} pub=${r.date_published} ${r.buyer?.ico}<-${r.supplier?.ico} :: ${(r.subject||'').slice(0,70)}`);
  if (prot.length===0) console.log('  ziadne');

  // (2) skupiny podla (subject+strany) BEZ amount, len vysoka suma (>=100k), count>1 s ROZNYMI sumami
  const g = {};
  for (const r of crz) {
    const k = norm(r.subject) + '|' + (r.buyer?.ico||'?') + '|' + (r.supplier?.ico||'?');
    (g[k]=g[k]||[]).push(r);
  }
  console.log('\n=== Skupiny (subject+strany) s count>1 kde MAX suma >=100000 (potencialny velky dup, aj rozne sumy) ===');
  const flagged = [];
  for (const [k,a] of Object.entries(g)) {
    if (a.length < 2) continue;
    const max = Math.max(...a.map(r => Number(r.amount_eur)||0));
    if (max < 100000) continue;
    const amts = a.map(r => (Number(r.amount_eur)||0));
    const distinctAmts = new Set(amts.map(x=>x.toFixed(2)));
    flagged.push({ k, a, max, distinctAmts: distinctAmts.size });
  }
  flagged.sort((x,y)=>y.max-x.max);
  for (const f of flagged) {
    console.log(`\n  MAXamt=${f.max.toFixed(2)} count=${f.a.length} distinctAmts=${f.distinctAmts} :: ${(f.a[0].subject||'').slice(0,80)}`);
    console.log(`     strany: ${f.a[0].buyer?.name} (${f.a[0].buyer?.ico}) <- ${f.a[0].supplier?.name} (${f.a[0].supplier?.ico})`);
    for (const r of f.a) console.log(`       ${r.external_id} amt=${(Number(r.amount_eur)||0).toFixed(2)} pub=${r.date_published}`);
  }
  if (flagged.length===0) console.log('  ziadne');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
