// WATCH stráž: READ-ONLY detekcia DVOJITÉHO ZVEREJNENIA NFP/CRZ zmlúv.
// NFP/dotačné zmluvy zverejňujú v CRZ OBE strany (poskytovateľ + prijímateľ) -> ten istý
// dokument 2x s rôznym CRZ ID a rôznym evidenčným č. zmluvy. Double-count nafukuje hero.
// Kľúč na dvojité zverejnenie: rovnaká amount_eur (>0) + rovnaká dvojica (buyer_ico, supplier_ico).
// Aby sme vylúčili legitímne opakované platby (nájom 500€/mes): reportujeme skupinu len ak
// subjecty sú si PODOBNÉ (rovnaký NFP kód / rovnaká normalizovaná hlavička). Nič nemení.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  const body = src.slice(src.indexOf('new Set<string>(['));
  return new Set(body.match(UUID_RE) || []);
}

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// vytiahni NFP/IROP referenčný kód zo subjectu (najsilnejší identifikátor tej istej zmluvy)
function nfpKey(subj) {
  if (!subj) return null;
  const m = subj.match(/(IROP|OPKZP|OPII|OPLZ|OP[ ]?[ĽL]Z|Z-?30\d{7,}|30\d{9,}|NFP\s*\d+)[A-Za-z0-9\/-]*/i);
  return m ? m[0].replace(/\s+/g, '').toUpperCase() : null;
}
// hrubá normalizácia predmetu (prvých ~50 znakov bez diakritiky/medzier) pre nie-NFP prípady
function subjNorm(subj) {
  return (subj || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

async function main() {
  const INCOME = loadIncomeIds();
  const rows = await fetchAll();
  console.log('total rows =', rows.length, '| INCOME_TX_IDS =', INCOME.size);

  // skupiny: kľúč = amount|buyerIco|supplierIco (len CRZ, amount>0)
  const groups = {};
  for (const r of rows) {
    if (r.source_type !== 'CRZ_CONTRACT') continue;
    const amt = Number(r.amount_eur) || 0;
    if (amt <= 0) continue;
    const bi = r.buyer?.ico || '?';
    const si = r.supplier?.ico || '?';
    const k = amt.toFixed(2) + '|' + bi + '|' + si;
    (groups[k] = groups[k] || []).push(r);
  }
  const dup = Object.entries(groups).filter(([, a]) => a.length > 1);
  console.log('\nSkupiny (amount+buyer+supplier) s count>1 =', dup.length);

  let totalDoubleCount = 0;         // extra suma nad prvým výskytom v POTVRDENÝCH dvojitých zverejneniach
  let incomeDoubleCount = 0;        // z toho v INCOME (nafukuje hero income)
  const suspectGroups = [];

  for (const [k, arr] of dup) {
    const amt = Number(arr[0].amount_eur) || 0;
    // rozhodni či je to dvojité zverejnenie: rovnaký NFP kód ALEBO takmer identický subject
    const nfps = new Set(arr.map(r => nfpKey(r.subject)).filter(Boolean));
    const subjs = new Set(arr.map(r => subjNorm(r.subject)));
    const sameNfp = nfps.size === 1 && [...nfps][0];
    const sameSubj = subjs.size === 1;
    const likelyDouble = sameNfp || sameSubj;
    const nInc = arr.filter(r => INCOME.has(r.id)).length;
    const rec = {
      amount: amt, buyer: arr[0].buyer?.name, buyerIco: arr[0].buyer?.ico,
      supplier: arr[0].supplier?.name, supplierIco: arr[0].supplier?.ico,
      count: arr.length, nfp: sameNfp || null, sameSubj,
      likelyDouble, incomeMembers: nInc,
      exts: arr.map(r => r.external_id), dates: arr.map(r => r.date_published),
      subjectSample: (arr[0].subject || '').slice(0, 90),
    };
    if (likelyDouble) {
      totalDoubleCount += amt * (arr.length - 1);
      if (nInc > 0) incomeDoubleCount += amt * (Math.min(nInc, arr.length) - 1 >= 0 ? (nInc - (nInc < arr.length ? 0 : 0)) : 0);
      suspectGroups.push(rec);
    } else {
      // pravdepodobne legitímne opakované platby — vypíš stručne na kontrolu
      suspectGroups.push(rec);
    }
  }

  // presnejší income double-count: pre každú likelyDouble skupinu, extra income = amt * (počet INCOME členov - 1) ak >1 INCOME členov,
  // + ak 1 income + 1+ non-income s rovnakou zmluvou, income člen je legit (druhá strana je expense/neklasif.)
  let incExtra = 0;
  for (const g of suspectGroups) {
    if (!g.likelyDouble) continue;
    if (g.incomeMembers > 1) incExtra += g.amount * (g.incomeMembers - 1);
  }

  suspectGroups.sort((a, b) => b.amount * (b.count - 1) - a.amount * (a.count - 1));
  console.log('\n=== KANDIDÁTI (zoradené podľa dopadu) ===');
  for (const g of suspectGroups.slice(0, 40)) {
    console.log(`${g.likelyDouble ? 'DBL ' : 'rep '} amt=${g.amount.toFixed(2)} x${g.count} inc=${g.incomeMembers} nfp=${g.nfp||'-'} sameSubj=${g.sameSubj}`);
    console.log(`     ${g.buyer} (${g.buyerIco}) <- ${g.supplier} (${g.supplierIco})`);
    console.log(`     exts=[${g.exts.join(',')}] dates=[${g.dates.join(',')}]`);
    console.log(`     subj: ${g.subjectSample}`);
  }
  console.log('\n=== SÚHRN ===');
  console.log('likelyDouble skupín =', suspectGroups.filter(g => g.likelyDouble).length);
  console.log('opakované-platby (nie double) skupín =', suspectGroups.filter(g => !g.likelyDouble).length);
  console.log('extra suma z likelyDouble (nad 1. výskytom, VŠETKY) =', totalDoubleCount.toFixed(2), 'EUR');
  console.log('z toho INCOME double-count (nafukuje hero income) =', incExtra.toFixed(2), 'EUR');

  fs.writeFileSync('.audit/watch_nfp_dupes_result.json', JSON.stringify(suspectGroups, null, 2));
  console.log('\n(uložené .audit/watch_nfp_dupes_result.json)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
