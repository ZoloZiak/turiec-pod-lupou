// T10: read-only overenie tabulky promises (Slubomer).
// Cielom je zistit REALNY obsah DB: kolko slubov, komu su priradene (politician_name),
// aky maju status (SPLNENE/V RIESENI/ZABUDNUTE), source_url a related_transaction_ids.
// POISTKA: menovana osoba (Jan Danko) - neovereny negativny status nesmie stat ako fakt.
// READ-ONLY (ziadny zapis).
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count, error } = await supabase
    .from('promises')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.log('promises: ERR ' + error.message);
    return;
  }
  console.log('promises COUNT = ' + count);
  if (!count || count === 0) {
    console.log('OK: tabulka prazdna, UI zobrazi cestny prazdny stav.');
    return;
  }
  const { data, error: e2 } = await supabase
    .from('promises')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (e2) { console.log('rows ERR ' + e2.message); return; }
  console.log('--- promises rows ---');
  const allTxIds = [];
  for (const r of data) {
    const rel = r.related_transaction_ids || [];
    if (Array.isArray(rel)) allTxIds.push(...rel);
    console.log(JSON.stringify({
      id: r.id,
      politician_name: r.politician_name,
      title: r.title,
      status: r.status,
      source_url: r.source_url,
      related_transaction_ids: rel,
      description: r.description ? String(r.description).slice(0, 160) : null
    }));
  }
  // status rozdelenie
  const byStatus = {};
  for (const r of data) { const s = r.status || '(null)'; byStatus[s] = (byStatus[s]||0)+1; }
  console.log('--- status distribution ---');
  console.log(JSON.stringify(byStatus));
  // politici
  const byPol = {};
  for (const r of data) { const p = r.politician_name || '(null)'; byPol[p] = (byPol[p]||0)+1; }
  console.log('--- politician distribution ---');
  console.log(JSON.stringify(byPol));
  // over related transactions existuju
  const uniqTx = [...new Set(allTxIds)];
  console.log('--- related_transaction_ids unique count = ' + uniqTx.length + ' ---');
  if (uniqTx.length > 0) {
    const { data: txs, error: e3 } = await supabase
      .from('transactions')
      .select('id, subject, amount_eur, source_url, source_type')
      .in('id', uniqTx);
    if (e3) { console.log('tx lookup ERR ' + e3.message); }
    else {
      const found = new Set((txs||[]).map(t => t.id));
      for (const tid of uniqTx) {
        const t = (txs||[]).find(x => x.id === tid);
        if (t) console.log('TX OK ' + JSON.stringify({ id: t.id, subject: (t.subject||'').slice(0,80), amount_eur: t.amount_eur, source_url: t.source_url }));
        else console.log('TX MISSING id=' + tid + ' (related_transaction_id neexistuje v transactions!)');
      }
      console.log('related tx: ' + found.size + '/' + uniqTx.length + ' existuje v transactions');
    }
  }
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
