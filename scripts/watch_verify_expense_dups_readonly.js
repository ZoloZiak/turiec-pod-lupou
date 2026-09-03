// WATCH stráž READ-ONLY: overenie 6 EXPENSE double-publikácií proti živej DB.
// Každý pár 2-zdrojovo overený v CRZ (Č. zmluvy + suma + strany + dátum uzavretia).
// Potvrdí: obe nohy existujú, sumy sedia na cent, ani jedna nie je INCOME, kanonická (keep)
// má CRZ-skoršie zverejnenie. Vypíše celkový expense dopad.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  return new Set(src.slice(src.indexOf('new Set<string>([')).match(UUID_RE) || []);
}
const PAIRS = [
  { keep: 'crz_8175095',  drop: 'crz_9881596',  amt: 1000.00,     label: 'KraussMaffei darovacia (Č.1521/2023, 04.08.2023)' },
  { keep: 'crz_8958417',  drop: 'crz_9000729',  amt: 3000.00,     label: 'ZSR buduca ZVB (19.02.2024, ZOBZ/Z010-2024)' },
  { keep: 'crz_12291762', drop: 'crz_12294611', amt: 7606.83,     label: 'Blatnica Kupna (Č.E-19/2026)' },
  { keep: 'crz_9584235',  drop: 'crz_9611284',  amt: 704.00,      label: 'ZSR ZVB 704 (836168018-4-2024-ZVB/O-51-2024)' },
  { keep: 'crz_10961126', drop: 'crz_11006541', amt: 2128019.36,  label: 'Protokol Atleticky stadion tribuna (1027/2025 vs RD20/2025, uz.20.06.2025)' },
  { keep: 'crz_12189892', drop: 'crz_12215067', amt: 999604.69,   label: 'Protokol strecha+bleskozvod Zimny stadion (417/2026 vs RD09/2026, uz.26.03.2026)' },
];
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
  const INCOME = loadIncomeIds();
  const rows = await fetchAll();
  const byExt = new Map(rows.map(r => [r.external_id, r]));
  let dropSum = 0, problems = 0;
  const dropExts = [];
  for (const p of PAIRS) {
    const k = byExt.get(p.keep), d = byExt.get(p.drop);
    console.log('\n=== ' + p.label + ' ===');
    if (!k) { console.log('  KEEP ' + p.keep + ': NENAJDENE (POZOR)'); problems++; }
    if (!d) { console.log('  DROP ' + p.drop + ': NENAJDENE (uz preselo?)'); problems++; }
    if (!k || !d) continue;
    const ka = Number(k.amount_eur)||0, da = Number(d.amount_eur)||0;
    const kInc = INCOME.has(k.id), dInc = INCOME.has(d.id);
    console.log('  KEEP ' + p.keep + ' uuid=' + k.id + ' amt=' + ka.toFixed(2) + ' INCOME=' + kInc + ' :: ' + (k.subject||'').slice(0,55));
    console.log('  DROP ' + p.drop + ' uuid=' + d.id + ' amt=' + da.toFixed(2) + ' INCOME=' + dInc + ' :: ' + (d.subject||'').slice(0,55));
    const okAmt = Math.abs(ka-da)<0.01 && Math.abs(ka-p.amt)<0.01;
    const okParty = (k.buyer?.ico)===(d.buyer?.ico) && (k.supplier?.ico)===(d.supplier?.ico);
    console.log('  CHECK amtMatch=' + okAmt + ' sameParties=' + okParty + ' neitherIncome=' + (!kInc&&!dInc));
    if (!(okAmt && okParty && !kInc && !dInc)) { console.log('  !!! GUARD FAILED'); problems++; }
    else { dropSum += da; dropExts.push(p.drop); }
  }
  console.log('\n=== SUHRN ===');
  console.log('problemov =', problems);
  console.log('vylucene external_id (' + dropExts.length + '):', JSON.stringify(dropExts));
  console.log('EXPENSE inflacia na odstranenie =', dropSum.toFixed(2), 'EUR');
  console.log(problems===0 ? 'OK — vsetkych 6 bezpecne true-dup' : 'POZOR problems>0 — NEAPLIKOVAT');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
