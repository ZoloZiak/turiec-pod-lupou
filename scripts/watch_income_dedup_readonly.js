// WATCH stráž: BEZPEČNÁ kvantifikácia double-publikácie NFP zmlúv v INCOME (hero "dotácie").
// BEZPEČNÝ kľúč: zdieľané EXPLICITNÉ NFP/projektové referenčné číslo vytiahnuté z predmetu
//   (IROP-Z-..., IROP-PO..., č. 40xxxx, Z SKCZ..., č. 1069/2025 ...) + amount + buyer_ico + supplier_ico.
// Tento kľúč NIKDY nezlúči: opakované reklamy (bez ref čísla), rôzne projekty (rôzne ref), rôzne tranže.
// Reportuje LEN INCOME nohy (129) — to nafukuje "Získané dotácie". Nič nemení (READ-ONLY).
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

// Vytiahni NAJSILNEJŠÍ projektový/NFP identifikátor z predmetu zmluvy.
// Poradie od najšpecifickejšieho. Vracia normalizovaný string alebo null.
function projectRef(subj) {
  if (!subj) return null;
  const s = subj.replace(/\s+/g, ' ');
  // IROP-Z-302041M829-421-19, IROP-PO9-SC91-2023-108, IROP-VZ-...  (kanonizuj IROP-D1/OSOIROP variácie na jadro)
  let m = s.match(/IROP[-\s]?(?:Z|PO\d+|VZ|D1)?[-\s]?(\d{6,}[A-Z]?\d*)/i);
  if (m) return 'IROP:' + m[1].toUpperCase();
  // Z SKCZ304021CKS7 / Z401101FKB8 / Z401202F311  (kód projektu ITMS)
  m = s.match(/\bZ\s?([0-9]{6}[A-Z0-9]{3,7})\b/);
  if (m) return 'ITMS:' + m[1].toUpperCase();
  // č. 401202F311 / 401402B928 / 401406DUN6 (ITMS bez Z)
  m = s.match(/\b(40\d{4}[A-Z0-9]{3,6})\b/);
  if (m) return 'ITMS:' + m[1].toUpperCase();
  // č. 1069/2025, č. 1374/2025, č. 2026/573 (evidenčné číslo zmluvy o NFP/dotácii)
  m = s.match(/[čc]\.?\s?(\d{2,4}\/\d{4}|\d{4}\/\d{2,4})\b/i);
  if (m) return 'CN:' + m[1];
  return null;
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
  const incomeRows = rows.filter(r => INCOME.has(r.id));
  console.log('INCOME nôh =', incomeRows.length);

  // skupiny podľa (projectRef + amount + buyer + supplier)
  const groups = {};
  const noRef = [];
  for (const r of incomeRows) {
    const ref = projectRef(r.subject);
    if (!ref) { noRef.push(r); continue; }
    const amt = Number(r.amount_eur) || 0;
    const k = ref + '|' + amt.toFixed(2) + '|' + (r.buyer?.ico || '?') + '|' + (r.supplier?.ico || '?');
    (groups[k] = groups[k] || []).push(r);
  }

  const dupGroups = Object.entries(groups).filter(([, a]) => a.length > 1);
  const singleGroups = Object.entries(groups).filter(([, a]) => a.length === 1);

  let incomeAll = 0, incomeDedup = 0, inflation = 0;
  const dupIds = [];
  for (const r of incomeRows) incomeAll += Number(r.amount_eur) || 0;

  console.log('\n=== POTVRDENÉ DOUBLE-PUBLIKÁCIE (zdieľané NFP/projektové ref č.) ===');
  const dupDetail = [];
  for (const [k, a] of dupGroups) {
    const amt = Number(a[0].amount_eur) || 0;
    const sorted = [...a].sort((x, y) => (x.date_published || '').localeCompare(y.date_published || '') || (x.external_id || '').localeCompare(y.external_id || ''));
    inflation += amt * (a.length - 1);
    for (const e of sorted.slice(1)) dupIds.push(e.id);
    dupDetail.push({ ref: k.split('|')[0], amount: amt, count: a.length,
      buyer: a[0].buyer?.ico, supplier: a[0].supplier?.ico,
      exts: sorted.map(r => r.external_id), dates: sorted.map(r => r.date_published),
      subj: (a[0].subject || '').slice(0, 90) });
  }
  dupDetail.sort((x, y) => (y.amount * (y.count - 1)) - (x.amount * (x.count - 1)));
  for (const d of dupDetail) {
    console.log(`${d.ref}  amt=${d.amount.toFixed(2)} x${d.count}  ${d.buyer}<-${d.supplier}`);
    console.log(`   exts=[${d.exts.join(',')}] dates=[${d.dates.join(',')}]`);
    console.log(`   ${d.subj}`);
  }

  const dupSet = new Set(dupIds);
  for (const r of incomeRows) if (!dupSet.has(r.id)) incomeDedup += Number(r.amount_eur) || 0;

  console.log('\n=== INCOME nohy BEZ parseable ref (nedajú sa 2-zdrojovo označiť ako dup — PONECHANÉ) ===');
  console.log('počet =', noRef.length, '| suma =', noRef.reduce((a, r) => a + (Number(r.amount_eur) || 0), 0).toFixed(2));
  for (const r of noRef.slice(0, 20)) console.log(`   ${r.external_id} amt=${(Number(r.amount_eur)||0).toFixed(2)} :: ${(r.subject||'').slice(0,80)}`);

  console.log('\n=== SÚHRN INCOME (BEZPEČNÝ dedup podľa zdieľaného ref) ===');
  console.log('potvrdených dup skupín =', dupGroups.length, '| duplikátnych nôh na neignorovanie v súčte =', dupIds.length);
  console.log('unikátnych projektov s ref (skupiny=1) =', singleGroups.length);
  console.log('income RAW (web dnes)   =', incomeAll.toFixed(2), 'EUR');
  console.log('income DEDUP (bezpečný) =', incomeDedup.toFixed(2), 'EUR');
  console.log('NAFÚKNUTIE (istá dolná hranica) =', inflation.toFixed(2), 'EUR');

  fs.writeFileSync('.audit/watch_income_dedup.json', JSON.stringify({ dupDetail, dupIds, incomeAll, incomeDedup, inflation, noRefCount: noRef.length }, null, 2));
  console.log('\n(uložené .audit/watch_income_dedup.json)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
