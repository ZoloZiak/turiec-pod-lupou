// DV-ICO-ALL batch 280-314 FINAL fix. Vsetky zmeny overene 2-zdrojovo (CRZ detail + RPO).
// Idempotentny, DRY-RUN default; --apply vykona. Zmeny:
//  1) STAVGOR zla entita 52417751 -> tx na existujucu 55014551, zla entita zmazana
//     (CRZ 11027451: dodavatel ICO 55014551)
//  2) JM Systems 53457919 -> 52461491 (RPO Trenčín; CRZ 9653017/10488788)
//  3) PROXIMA, a.s. 53053800 -> 36384224 (RPO Žilina; CRZ 12212458 bez ICO v DB)
//  4) Základná škola 57177392 -> 37811801 (CRZ 7696800 + RPO: ZŠ A. Stodolu 60 Martin)
//  5) ParkDots s.r.o. 55477232: ICO spravne, alebo premenovany -> "Sigma services s.r.o." (RPO)
//  6) 12 kozmetických rename na oficiálne RPO tvary
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

(async () => {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN ===');

  // --- 1) merge STAVGOR ---
  const { data: bad } = await supabase.from('entities').select('id,name').eq('ico', '52417751');
  const { data: good } = await supabase.from('entities').select('id,name').eq('ico', '55014551');
  if (!bad || !bad.length) console.log('1) SKIP: 52417751 už neexistuje');
  else if (!good || !good.length) console.log('1) STOP: cieľová entita 55014551 neexistuje');
  else {
    const bid = bad[0].id;
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_entity_id', bid);
    console.log(`1) STAVGOR merge: ${count} tx ${bid} -> ${good[0].id}`);
    if (APPLY && count > 0) {
      const { error } = await supabase.from('transactions').update({ supplier_entity_id: good[0].id }).eq('supplier_entity_id', bid);
      if (error) { console.log('   ERROR tx:', error.message); process.exit(1); }
      const { count: after } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).or(`supplier_entity_id.eq.${bid},buyer_entity_id.eq.${bid}`);
      if (after !== 0) { console.log(`   STOP: ostalo ${after} tx`); process.exit(1); }
      const { error: e2 } = await supabase.from('entities').delete().eq('id', bid);
      console.log(e2 ? '   ERROR del: ' + e2.message : '   OK: merged + zmazané');
    } else if (APPLY) {
      const { error: e2 } = await supabase.from('entities').delete().eq('id', bid);
      console.log(e2 ? '   ERROR del: ' + e2.message : '   OK: entita zmazaná (bez tx)');
    }
  }

  // --- 2-5) ICO/name updates ---
  const UPDATES = [
    { label: '2) JM Systems ico', icoOld: '53457919', set: { ico: '52461491' } },
    { label: '3) PROXIMA ico', icoOld: '53053800', set: { ico: '36384224' } },
    { label: '4) ZŠ ico+názov', icoOld: '57177392', set: { ico: '37811801', name: 'Základná škola, A. Stodolu 60, Martin' } },
    { label: '5) ParkDots názov', icoOld: '55477232', set: { name: 'Sigma services s.r.o.' } },
    { label: '6a) PMP TRUCK', icoOld: '52439453', set: { name: 'PMP TRUCK, s. r. o.' } },
    { label: '6b) FORTIVA', icoOld: '52835162', set: { name: 'FORTIVA s. r. o.' } },
    { label: '6c) ROOFLife', icoOld: '52968120', set: { name: 'ROOFLife s. r. o.' } },
    { label: '6d) A-LED SK', icoOld: '53249682', set: { name: 'A-LED SK, s. r. o.' } },
    { label: '6e) DP Martin', icoOld: '53560922', set: { name: 'Dopravný podnik mesta Martin, s. r. o.' } },
    { label: '6f) Revital Holding', icoOld: '53624599', set: { name: 'Revital Holding s. r. o.' } },
    { label: '6g) Autoškola Líška', icoOld: '53651839', set: { name: 'Autoškola Ľubomír Líška s. r. o.' } },
    { label: '6h) Sinep', icoOld: '54722446', set: { name: 'Sinep, s. r. o.' } },
    { label: '6i) ARCH NEZVAL', icoOld: '55568301', set: { name: 'ARCH NEZVAL s. r. o.' } },
    { label: '6j) MB Nezabudka', icoOld: '55855431', set: { name: 'MB Nezabudka s. r. o.' } },
    { label: '6k) XAZ design', icoOld: '56508093', set: { name: 'XAZ design s. r. o.' } },
    { label: '6l) ODEKON', icoOld: '57542996', set: { name: 'ODEKON s. r. o.' } },
  ];
  for (const u of UPDATES) {
    const { data: ents } = await supabase.from('entities').select('id,name,ico').eq('ico', u.icoOld);
    if (!ents || !ents.length) { console.log(`${u.label}: SKIP (entita neexistuje / už opravená)`); continue; }
    const e = ents[0];
    const needs = Object.entries(u.set).filter(([k, v]) => e[k] !== v);
    if (!needs.length) { console.log(`${u.label}: SKIP (už OK)`); continue; }
    const patch = {}; for (const [k, v] of needs) patch[k] = v;
    console.log(`${u.label}: ${e.ico} "${e.name}" -> ${JSON.stringify(patch)}`);
    if (APPLY) {
      const { error } = await supabase.from('entities').update(patch).eq('id', e.id);
      console.log(error ? '   ERROR: ' + error.message : '   OK');
    }
  }
})();
