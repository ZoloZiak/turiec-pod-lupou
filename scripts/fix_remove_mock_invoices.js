// Cleanup FABRIKÁTU: 9 WEB_INVOICE transakcií = mock dáta zo scraper-invoices.ts (mockHtml).
// Dôkaz: external_id FA-2026/0801-0803 x3 zdroje, dodávatelia NO_ICO_SERVISAS/PAPIERNICTVOSRO/CESTNSTAVBYMART,
//        zdrojová stránka parkovaniemartin.sk/faktury-a-objednavky = 503/mŕtva, Wayback = 0 snapshotov (nikdy neexistovala).
// Politika: fabrikát na transparentnom webe = REMOVE-NOW. Nie menované osoby (fiktívne firmy) -> poistka nebráni.
// Idempotentné. Dry-run default; --apply vykoná mazanie. Mažú sa LEN tie tx + fiktívni dodávatelia AK nie sú použití inde.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const FAKE_SUPPLIER_ICOS = ['NO_ICO_SERVISAS', 'NO_ICO_PAPIERNICTVOSRO', 'NO_ICO_CESTNSTAVBYMART'];

(async () => {
  // 1. nájdi všetky WEB_INVOICE tx s mock external_id (FA-2026/080x)
  const { data: tx, error } = await supabase.from('transactions')
    .select('id, external_id, amount_eur, subject, source_url, supplier_entity_id')
    .eq('source_type', 'WEB_INVOICE');
  if (error) { console.log('ERR tx: ' + error.message); process.exit(1); }
  const mock = tx.filter(t => /FA-2026\/080[123]$/.test(t.external_id || ''));
  console.log(`WEB_INVOICE total: ${tx.length}, mock-signature (na zmazanie): ${mock.length}`);
  mock.forEach(t => console.log(`  DEL tx ${t.external_id} | ${t.amount_eur} EUR | ${t.source_url}`));

  // 2. over či fiktívni dodávatelia sú použití AJ v iných (nie-mock) transakciách
  const { data: fakeEnts } = await supabase.from('entities').select('id, ico, name').in('ico', FAKE_SUPPLIER_ICOS);
  const mockIds = new Set(mock.map(t => t.id));
  for (const e of (fakeEnts || [])) {
    const { data: uses } = await supabase.from('transactions').select('id, source_type, external_id').eq('supplier_entity_id', e.id);
    const otherUses = (uses || []).filter(u => !mockIds.has(u.id));
    console.log(`\nENTITY ${e.ico} (${e.name}) id=${e.id}: total refs=${(uses||[]).length}, mimo-mock refs=${otherUses.length}`);
    otherUses.forEach(u => console.log(`    ! iné použitie: ${u.source_type} ${u.external_id}`));
    e._safeToDelete = otherUses.length === 0;
  }

  if (!APPLY) { console.log('\n[DRY-RUN] žiadne zmeny. Spusti s --apply.'); return; }

  // 3. APPLY: najprv tx, potom bezpeční dodávatelia
  let delTx = 0;
  for (const t of mock) {
    const { error: e } = await supabase.from('transactions').delete().eq('id', t.id);
    if (e) console.log(`  ERR del tx ${t.external_id}: ${e.message}`); else delTx++;
  }
  console.log(`\nzmazaných tx: ${delTx}/${mock.length}`);
  let delEnt = 0;
  for (const e of (fakeEnts || [])) {
    if (!e._safeToDelete) { console.log(`  SKIP entity ${e.ico} (použitá inde)`); continue; }
    const { error: er } = await supabase.from('entities').delete().eq('id', e.id);
    if (er) console.log(`  ERR del entity ${e.ico}: ${er.message}`); else { delEnt++; console.log(`  zmazaná entity ${e.ico}`); }
  }
  console.log(`zmazaných fiktívnych dodávateľov: ${delEnt}`);
})();
