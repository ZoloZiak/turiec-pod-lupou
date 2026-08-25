// T17c: READ-ONLY sken UNIKNUTYCH NFP prijmov v EXPENSE.
// Hlada transakcie, ktore su klasifikovane ako VYDAVOK (nie v INCOME_TX_IDS), ale
// vyzeraju ako PRIJEM: supplier = ministerstvo/agentura/urad/kraj (poskytovatel NFP)
// A predmet obsahuje "nenavratneho financneho prispevku"/"NFP"/"poskytnuti dotacie".
// Ak taketo existuju, klasifikacia smeru unikla dalsie prijmy => vydavky nafuknute.
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
function loadUnsureIds() {
  const src = fs.readFileSync('src/lib/unsure-ids.ts', 'utf8');
  const body = src.slice(src.indexOf('UNSURE_REVIEW'), src.indexOf('UNSURE_TX_IDS'));
  return new Set((body.match(/id:\s*"([0-9a-f-]{36})"/g) || []).map(s => s.slice(5).replace(/"/g,'')));
}

const PROVIDER_RE = /minister|agentúr|agentur|úrad práce|urad prace|samosprávny kraj|samospravny kraj|ŠFRB|ŠTÁTNY FOND|štátny fond|environmentálny fond|pôdohospodárska platobná/i;
const NFP_RE = /nenávratného finančného príspevku|nenavratneho financneho prispevku|\bNFP\b|poskytnutí dotácie|poskytnuti dotacie|poskytnutí príspevku|poskytnutí finančného príspevku|o poskytnutí grantu/i;

async function main() {
  const INCOME = loadIncomeIds();
  const UNSURE = loadUnsureIds();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, source_type, amount_eur, subject, buyer:buyer_entity_id(name,ico), supplier:supplier_entity_id(name,ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`=== T17c uniknute NFP v EXPENSE (READ-ONLY), ${rows.length} tx ===`);
  const suspects = rows.filter(t => {
    if (INCOME.has(t.id)) return false; // uz je prijem
    const subj = t.subject || '';
    const supName = t.supplier ? t.supplier.name : '';
    const nfp = NFP_RE.test(subj);
    const provider = PROVIDER_RE.test(supName);
    return nfp && provider;
  }).map(t => ({ ...t, amt: Number(t.amount_eur) || 0 }));
  suspects.sort((a, b) => b.amt - a.amt);
  let sum = 0; suspects.forEach(s => sum += s.amt);
  console.log(`Kandidatov na uniknuty prijem: ${suspects.length}, spolu ${sum.toFixed(2)} EUR`);
  console.log('(oznacene [UNSURE] su uz v review liste)');
  for (const t of suspects) {
    const tag = UNSURE.has(t.id) ? '[UNSURE]' : '[MIMO-REVIEW]';
    const s = t.supplier ? t.supplier.name : '—';
    const b = t.buyer ? t.buyer.name : '—';
    console.log(`${tag} ${t.amt.toFixed(2).padStart(13)} | BUYER=${b} | SUP=${s}`);
    console.log(`   ${t.id} | ${(t.subject||'').slice(0,85)}`);
  }
  console.log('=== koniec T17c ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
