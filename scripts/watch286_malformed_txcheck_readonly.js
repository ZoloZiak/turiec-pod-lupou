// READ-ONLY WATCH #286 — OPRAVA tx-count sondy pre malformed IČO entity.
// watch_ico_malformed_readonly.js počíta tx cez .eq('entity_id', e.id) — taký stĺpec
// v transactions NEEXISTUJE (schema má supplier_entity_id / buyer_entity_id) => tx_count=0
// bol FALOŠNE NEGATÍVNY. Tu prepočítam tx cez SPRÁVNE stĺpce, aby sme vylúčili malformed
// IČO ktoré reálne visí na webe (regresia nového egov CORA scrapera, dataset 315->839 IČO).
// Nič nemení v DB. Zapíše .audit/WATCH286_malformed_txcheck.json
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1) vsetky entity, vyfiltruj malformed (nie NO_ICO_, nie cisty 8-cifr)
  let ents = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('entities').select('id,ico,name').range(from, from + PAGE - 1);
    if (error) { console.log('ERR entities: ' + error.message); process.exit(1); }
    ents = ents.concat(data);
    if (data.length < PAGE) break;
  }
  const malformed = ents.filter(e => {
    const ico = String(e.ico || '');
    if (!ico) return false;
    if (ico.startsWith('NO_ICO_')) return false;
    if (/^\d{8}$/.test(ico)) return false;
    return true;
  });
  console.log(`entities total: ${ents.length} | malformed: ${malformed.length}`);

  const out = [];
  for (const e of malformed) {
    // tx count cez SPRÁVNE stĺpce (supplier alebo buyer), s exact count
    const { count: supCount, error: se } = await sb.from('transactions')
      .select('id', { count: 'exact', head: true }).eq('supplier_entity_id', e.id);
    const { count: buyCount, error: be } = await sb.from('transactions')
      .select('id', { count: 'exact', head: true }).eq('buyer_entity_id', e.id);
    // sample source_url ak nejake tx su
    let sample = null;
    if ((supCount || 0) + (buyCount || 0) > 0) {
      const { data: s } = await sb.from('transactions')
        .select('id,source_url,subject,amount_eur')
        .or(`supplier_entity_id.eq.${e.id},buyer_entity_id.eq.${e.id}`).limit(1);
      if (s && s.length) sample = s[0];
    }
    out.push({
      id: e.id, ico: e.ico, name: e.name,
      sup_tx: supCount || 0, buy_tx: buyCount || 0,
      sup_err: se ? se.message : null, buy_err: be ? be.message : null,
      total_tx: (supCount || 0) + (buyCount || 0), sample,
    });
  }
  out.sort((a, b) => b.total_tx - a.total_tx);
  fs.writeFileSync('.audit/WATCH286_malformed_txcheck.json', JSON.stringify(out, null, 2));
  const withTx = out.filter(r => r.total_tx > 0);
  console.log(`\n=== malformed s tx>0 (SPRÁVNE stĺpce): ${withTx.length} / ${out.length} ===`);
  for (const r of out) {
    console.log(`tx=${r.total_tx} (sup=${r.sup_tx},buy=${r.buy_tx})\t"${r.ico}"\t${r.name || '(bez názvu)'}`);
  }
  if (withTx.length) {
    console.log('\n!!! MALFORMED IČO S ŽIVÝMI TRANSAKCIAMI (regresia?):');
    for (const r of withTx) console.log(JSON.stringify(r, null, 1));
  }
})().catch(e => console.log('FATAL: ' + e.message));
