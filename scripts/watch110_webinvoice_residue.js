// READ-ONLY WATCH #111: confirm the NO-OP scraper-invoices.ts left ZERO residue in prod DB.
// Checks: (1) any WEB_INVOICE source_type transactions, (2) any transactions whose source_url
// points at the dead parkovaniemartin/dpmmartin/turiec faktury pages, (3) any NO_ICO_ entities
// created by the scraper's fallback naming (Servis a.s. / Papiernictvo / Cestne stavby fabricated).
// Usage: node scripts/watch110_webinvoice_residue.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

async function countExact(supabase, table, apply) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) return 'ERR:' + error.message;
  return count;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const webInvoiceTx = await countExact(supabase, 'transactions', q => q.eq('source_type', 'WEB_INVOICE'));
  const parkovanieTx = await countExact(supabase, 'transactions', q => q.ilike('source_url', '%parkovaniemartin%'));
  const dpmTx = await countExact(supabase, 'transactions', q => q.ilike('source_url', '%dpmmartin%'));
  const turiecTx = await countExact(supabase, 'transactions', q => q.ilike('source_url', '%turiec.com%'));
  const noIcoEnt = await countExact(supabase, 'entities', q => q.ilike('ico', 'NO\\_ICO\\_%'));

  // fabricated supplier names from the old mock (should be 0)
  const fabNames = ['%Servis a.s%', '%Papiernictvo%', '%Cestné stavby Martin%', '%Cestne stavby Martin%'];
  const fabHits = {};
  for (const n of fabNames) {
    fabHits[n] = await countExact(supabase, 'entities', q => q.ilike('name', n));
  }

  const out = {
    web_invoice_tx: webInvoiceTx,
    parkovaniemartin_source_url_tx: parkovanieTx,
    dpmmartin_source_url_tx: dpmTx,
    turiec_com_source_url_tx: turiecTx,
    no_ico_entities_total: noIcoEnt,
    fabricated_supplier_name_hits: fabHits,
  };
  console.log(JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
