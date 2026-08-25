// T17d: READ-ONLY export 42 uniknutych NFP kandidatov so source_url do .audit trailu.
// Deterministicky filter (rovnaky ako T17c): NIE v INCOME_TX_IDS, supplier = statny
// poskytovatel (min/agentura/urad prace/kraj/fond), subject = NFP/dotacia/prispevok.
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
const PROVIDER_RE = /minister|agentúr|agentur|úrad práce|urad prace|samosprávny kraj|samospravny kraj|ŠFRB|ŠTÁTNY FOND|štátny fond|environmentálny fond|pôdohospodárska platobná/i;
const NFP_RE = /nenávratného finančného príspevku|nenavratneho financneho prispevku|\bNFP\b|poskytnutí dotácie|poskytnuti dotacie|poskytnutí príspevku|poskytnutí finančného príspevku|o poskytnutí grantu/i;

async function main() {
  const INCOME = loadIncomeIds();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, source_type, amount_eur, subject, source_url, buyer:buyer_entity_id(name,ico), supplier:supplier_entity_id(name,ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const suspects = rows.filter(t => {
    if (INCOME.has(t.id)) return false;
    return NFP_RE.test(t.subject || '') && PROVIDER_RE.test(t.supplier ? t.supplier.name : '');
  }).map(t => ({
    id: t.id,
    amount_eur: Number(t.amount_eur) || 0,
    buyer: t.buyer ? t.buyer.name : null,
    buyer_ico: t.buyer ? t.buyer.ico : null,
    supplier: t.supplier ? t.supplier.name : null,
    supplier_ico: t.supplier ? t.supplier.ico : null,
    subject: t.subject,
    source_url: t.source_url,
  })).sort((a, b) => b.amount_eur - a.amount_eur);
  const sum = suspects.reduce((a, s) => a + s.amount_eur, 0);
  fs.writeFileSync('.audit/T17_leaked_nfp_set.json', JSON.stringify({ count: suspects.length, sum_eur: sum, items: suspects }, null, 2));
  console.log(`Zapisane ${suspects.length} kandidatov (spolu ${sum.toFixed(2)} EUR) do .audit/T17_leaked_nfp_set.json`);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
