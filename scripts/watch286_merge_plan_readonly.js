// READ-ONLY WATCH #286 — dedup+merge PLÁN pre 4 SK short6 orphan IČO -> kanon 8-cifr.
// Pre každý pár: nájdi orphan entitu (short6) + kanon entitu (8-cifr), vypíš ich tx external_id
// sety a over PREKRYV (ak orphan a kanon zdieľajú external_id -> merge by vytvoril duplicitu
// alebo je to tá istá tx). Nič nemení v DB. Zapíše .audit/WATCH286_merge_plan.json
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAIRS = [
  { wrong: '585441', good: '00585441', name: 'KOOPERATIVA poisťovňa' },
  { wrong: '316792', good: '00316792', name: 'Mesto Martin' },
  { wrong: '685852', good: '00685852', name: 'Messer Tatragas' },
  { wrong: '151653', good: '00151653', name: 'Slovenská sporiteľňa' },
];

async function ent(ico) {
  const { data } = await sb.from('entities').select('id,ico,name').eq('ico', ico);
  return data || [];
}
async function txMeta(field, id) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('transactions').select('id,external_id,source_url,subject,amount_eur').eq(field, id).range(from, from + 999);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

(async () => {
  const out = [];
  for (const p of PAIRS) {
    const orphans = await ent(p.wrong);
    const canons = await ent(p.good);
    const rec = { pair: `${p.wrong}->${p.good}`, name: p.name, orphan_ents: orphans, canon_ents: canons, overlap: [], orphan_tx: [], safe: null };
    if (orphans.length === 1 && canons.length === 1) {
      const oSup = await txMeta('supplier_entity_id', orphans[0].id);
      const oBuy = await txMeta('buyer_entity_id', orphans[0].id);
      const cSup = await txMeta('supplier_entity_id', canons[0].id);
      const cBuy = await txMeta('buyer_entity_id', canons[0].id);
      const canonExt = new Set([...cSup, ...cBuy].map(t => t.external_id).filter(Boolean));
      const orphanTx = [...oSup, ...oBuy];
      const overlap = orphanTx.filter(t => t.external_id && canonExt.has(t.external_id));
      rec.orphan_tx = orphanTx.map(t => ({ id: t.id, external_id: t.external_id, subject: t.subject, amount: t.amount_eur }));
      rec.overlap = overlap.map(t => t.external_id);
      rec.orphan_sup = oSup.length; rec.orphan_buy = oBuy.length;
      rec.canon_sup = cSup.length; rec.canon_buy = cBuy.length;
      rec.orphan_id = orphans[0].id; rec.canon_id = canons[0].id;
      rec.safe = overlap.length === 0;
    } else {
      rec.safe = false;
      rec.note = `neočakávaný počet entít: orphan=${orphans.length}, canon=${canons.length}`;
    }
    out.push(rec);
    console.log(`${rec.safe ? 'SAFE' : 'SKONTROLUJ'}\t${p.wrong}->${p.good} (${p.name})`);
    console.log(`  orphan entít=${orphans.length} tx(sup=${rec.orphan_sup||0},buy=${rec.orphan_buy||0}) | canon entít=${canons.length} tx(sup=${rec.canon_sup||0},buy=${rec.canon_buy||0}) | external_id PREKRYV=${rec.overlap.length}`);
  }
  fs.writeFileSync('.audit/WATCH286_merge_plan.json', JSON.stringify(out, null, 2));
  const safe = out.filter(o => o.safe);
  console.log(`\n=== ${safe.length}/${out.length} párov bezpečných na merge (0 external_id prekryv) ===`);
})().catch(e => console.log('FATAL: ' + e.message));
