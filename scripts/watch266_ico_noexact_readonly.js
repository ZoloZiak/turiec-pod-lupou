// READ-ONLY WATCH #266: dovyšetrenie dvoch NO_EXACT_MATCH z icoLive_305:
//   64833186 "K&K TECHNOLOGY a.s." (podozrenie: české IČO -> chýba v SK RPO = OK)
//   87110170 "Adam Ďurica" (podozrenie: neplatné/duplicitné IČO fyz. osoby)
// Pre každé: entity id, tx count (živý dopad na agregáty), sample source_url,
// existencia v ICO_CORRECTIONS, a nezávislý RPO ŠÚ SR lookup (presná zhoda identifiers[].value).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGETS = ['64833186', '87110170'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const out = [];
  for (const ico of TARGETS) {
    const rec = { ico, entities: [], tx_count: 0, sample_urls: [], rpo_status: '?', rpo_names: [] };
    // entity riadky s tymto ico
    const { data: ents } = await sb.from('entities').select('id,ico,name,entity_type').eq('ico', ico);
    rec.entities = ents || [];
    // tx count naprieč všetkými entitami s tymto ico (paginované)
    for (const e of (ents || [])) {
      for (let from = 0; ; from += 1000) {
        const { data: txs } = await sb.from('transactions').select('id,amount_eur,source_url,description').eq('entity_id', e.id).range(from, from + 999);
        if (!txs || !txs.length) break;
        rec.tx_count += txs.length;
        for (const t of txs) if (rec.sample_urls.length < 3 && t.source_url) rec.sample_urls.push(t.source_url);
        if (txs.length < 1000) break;
      }
    }
    // RPO lookup
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(25000),
      });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      if (exact.length === 0) { rec.rpo_status = 'NO_EXACT_MATCH'; rec.rpo_total = (d.results || []).length; }
      else { rec.rpo_status = 'EXACT'; exact.forEach(x => (x.fullNames || []).forEach(n => rec.rpo_names.push(n.value))); }
    } catch (e) { rec.rpo_status = 'ERR:' + e.message; }
    out.push(rec);
    await sleep(600);
  }
  fs.writeFileSync('.audit/WATCH266_ico_noexact_result.json', JSON.stringify(out, null, 2));
  for (const r of out) {
    console.log(`\n=== ${r.ico} | RPO=${r.rpo_status} | tx=${r.tx_count} | entities=${r.entities.length} ===`);
    for (const e of r.entities) console.log(`  entity ${e.id} type=${e.entity_type} name="${e.name}"`);
    if (r.rpo_names.length) console.log(`  RPO names: ${r.rpo_names.join(' | ')}`);
    if (r.sample_urls.length) console.log(`  sample tx url: ${r.sample_urls[0]}`);
  }
})();
