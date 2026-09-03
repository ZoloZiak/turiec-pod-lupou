// WATCH stráž: RIGORÓZNA kvantifikácia DVOJITÉHO ZVEREJNENIA CRZ zmlúv a jeho dopadu na hero.
// BEZPEČNÝ dedup kľúč (nemôže spojiť DVA RÔZNE dokumenty):
//   normSubject (bez diakritiky/medzier/interpunkcie, celý predmet) + amount_eur + buyer_ico + supplier_ico
// -> skupina size>1 = TEN ISTÝ dokument zverejnený viackrát (obe strany + re-scrape).
//    Rôzne sumy (zmluva vs dodatok) NEspojí, rôzne NFP projekty NEspojí, rôzne strany NEspojí.
// Počíta: skutočný dedup income/expense a nafúknutie hero. Za "duplikát na ignorovanie" berie
// všetky OKREM najskôr zverejneného člena (min date_published, tie-break min external_id).
// READ-ONLY, nič nemení.
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
function normSubj(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

async function main() {
  const INCOME = loadIncomeIds();
  const rows = await fetchAll();
  const crz = rows.filter(r => r.source_type === 'CRZ_CONTRACT');
  console.log('total rows =', rows.length, '| CRZ =', crz.length, '| INCOME_TX_IDS =', INCOME.size);

  // skupiny podľa bezpečného dedup kľúča (len CRZ; berieme aj amount 0 pre úplnosť, ale dopad = 0)
  const groups = {};
  for (const r of crz) {
    const amt = Number(r.amount_eur) || 0;
    const bi = r.buyer?.ico || '?';
    const si = r.supplier?.ico || '?';
    const k = normSubj(r.subject) + '|' + amt.toFixed(2) + '|' + bi + '|' + si;
    (groups[k] = groups[k] || []).push(r);
  }

  const dupGroups = Object.values(groups).filter(a => a.length > 1);
  // pre každú skupinu vyber "primary" (min date, tie-break min external_id), zvyšok = duplicate
  const dupIds = [];        // tx na ignorovanie z totalov
  const dupIncomeIds = [];  // z toho v INCOME
  let incomeInflation = 0, expenseInflation = 0;
  const detail = [];
  for (const a of dupGroups) {
    const amt = Number(a[0].amount_eur) || 0;
    const sorted = [...a].sort((x, y) =>
      (x.date_published || '').localeCompare(y.date_published || '') ||
      (x.external_id || '').localeCompare(y.external_id || ''));
    const primary = sorted[0];
    const extras = sorted.slice(1);
    for (const e of extras) {
      dupIds.push(e.id);
      const isInc = INCOME.has(e.id);
      if (isInc) { dupIncomeIds.push(e.id); incomeInflation += amt; }
      else expenseInflation += amt;
    }
    if (amt > 0) detail.push({
      amount: amt, count: a.length,
      buyer: a[0].buyer?.name, buyerIco: a[0].buyer?.ico,
      supplier: a[0].supplier?.name, supplierIco: a[0].supplier?.ico,
      primaryExt: primary.external_id, primaryDate: primary.date_published,
      dupExts: extras.map(e => e.external_id), dupDates: extras.map(e => e.date_published),
      incomeLegs: a.filter(r => INCOME.has(r.id)).length,
      subj: (a[0].subject || '').slice(0, 100),
    });
  }
  detail.sort((x, y) => (y.amount * (y.count - 1)) - (x.amount * (x.count - 1)));

  // Skutočné (dedup) hero čísla
  const dupSet = new Set(dupIds);
  let incRaw = 0, incDedup = 0, expRaw = 0, expDedup = 0;
  for (const r of rows) {
    const amt = Number(r.amount_eur) || 0;
    const isInc = INCOME.has(r.id);
    if (isInc) { incRaw += amt; if (!dupSet.has(r.id)) incDedup += amt; }
    else { expRaw += amt; if (!dupSet.has(r.id)) expDedup += amt; }
  }

  console.log('\n=== DUPLICITNÉ SKUPINY (identický predmet+suma+strany, amount>0) ===');
  for (const d of detail.slice(0, 25)) {
    console.log(`amt=${d.amount.toFixed(2)} x${d.count} incomeLegs=${d.incomeLegs}`);
    console.log(`   ${d.buyer} (${d.buyerIco}) <- ${d.supplier} (${d.supplierIco})`);
    console.log(`   primary=${d.primaryExt}(${d.primaryDate}) dup=[${d.dupExts.join(',')}] (${d.dupDates.join(',')})`);
    console.log(`   subj: ${d.subj}`);
  }

  console.log('\n=== SÚHRN ===');
  console.log('duplicitných skupín (amount>0) =', detail.length, '| všetkých vrátane amount=0 =', dupGroups.length);
  console.log('duplikátnych tx na ignorovanie z totalov =', dupIds.length, '(z toho v INCOME =', dupIncomeIds.length + ')');
  console.log('--- HERO INCOME ---');
  console.log('  raw (súčasný web)  =', incRaw.toFixed(2), 'EUR');
  console.log('  dedup (skutočný)   =', incDedup.toFixed(2), 'EUR');
  console.log('  NAFÚKNUTIE income  =', (incRaw - incDedup).toFixed(2), 'EUR');
  console.log('--- HERO EXPENSE ---');
  console.log('  raw (súčasný web)  =', expRaw.toFixed(2), 'EUR');
  console.log('  dedup (skutočný)   =', expDedup.toFixed(2), 'EUR');
  console.log('  NAFÚKNUTIE expense =', (expRaw - expDedup).toFixed(2), 'EUR');

  fs.writeFileSync('.audit/watch_dedup_result.json', JSON.stringify({ detail, dupIds, dupIncomeIds,
    incRaw, incDedup, expRaw, expDedup }, null, 2));
  console.log('\n(uložené .audit/watch_dedup_result.json)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
