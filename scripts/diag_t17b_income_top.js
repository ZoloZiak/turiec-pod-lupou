// T17b: READ-ONLY vypis TOP income transakcii (podla INCOME_TX_IDS) s protistranami.
// Ciel: overit ze klasifikacia INCOME je legitimna (dodavatel/buyer = ministerstvo/agentura/kraj,
// predmet = NFP/dotacia/grant), aby totalIncome nebol nafuknuty zlou klasifikaciou.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  const body = src.slice(src.indexOf('new Set<string>(['));
  return (body.match(UUID_RE) || []);
}

async function main() {
  const ids = loadIncomeIds();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, source_type, amount_eur, subject, source_url, buyer:buyer_entity_id(name,ico), supplier:supplier_entity_id(name,ico)')
    .in('id', ids);
  if (error) throw error;
  const rows = (data || []).map(t => ({ ...t, amt: Number(t.amount_eur) || 0 }));
  rows.sort((a, b) => b.amt - a.amt);
  console.log(`=== T17b TOP income tx (z ${ids.length} INCOME_TX_IDS, ${rows.length} najdenych v DB) ===`);
  let sum = 0;
  for (const t of rows) sum += t.amt;
  console.log(`Sucet vsetkych income v DB: ${sum.toFixed(2)} EUR`);
  console.log('--- TOP 20 ---');
  for (const t of rows.slice(0, 20)) {
    const b = t.buyer ? `${t.buyer.name} (${t.buyer.ico})` : '—';
    const s = t.supplier ? `${t.supplier.name} (${t.supplier.ico})` : '—';
    console.log(`${t.amt.toFixed(2).padStart(14)} | ${t.source_type} | BUYER=${b} | SUPPLIER=${s}`);
    console.log(`   subj: ${(t.subject||'').slice(0,90)}`);
  }
  // Kolko income ID sa NENASLO v DB (mozny drift)
  const foundIds = new Set(rows.map(r => r.id));
  const missing = ids.filter(i => !foundIds.has(i));
  console.log(`--- Income ID nenajdene v DB: ${missing.length} ---`);
  missing.forEach(m => console.log('  ' + m));
  console.log('=== koniec T17b ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
