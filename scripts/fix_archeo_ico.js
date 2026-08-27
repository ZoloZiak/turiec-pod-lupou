// WATCH tik #53 (IČO stráž, okno 260-279) — oprava zameneného IČO.
// DB entita name="ARCHEOVÝSKUM s.r.o." má ico=51690551, ktoré v RPO ŠÚ SR patrí FYZ. OSOBE
// "Simona Medveďová" (Register fin. agentov NBS, zaniknutý 2019-05-24) — NIE firme ARCHEOVÝSKUM.
// Reálne IČO firmy ARCHEOVÝSKUM s.r.o. = 46570870 (RPO: OR OS Žilina, Štúrova 3520 Lipt. Mikuláš),
// potvrdené aj CRZ detailom zmluvy 11861268 (Dodávateľ ARCHEOVÝSKUM s.r.o., IČO 46570870).
// Entita má 1 reálnu tx -> NEMAZAŤ (na rozdiel od TRITON orphan), ale OPRAVIŤ IČO 51690551 -> 46570870.
// Idempotentný: dry-run default, --apply vykoná. Guard: mení LEN ak existuje práve 1 entita s ico=51690551
// A name obsahuje ARCHEO A v DB NIE je konfliktná entita s cieľovým ico=46570870 (inak abort=ručný merge).
// Firemná entita -> poistka menovaných osôb sa neuplatňuje (len REMOVE/oprava nesprávneho párovania).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const OLD_ICO = '51690551';
const NEW_ICO = '46570870';

(async () => {
  const { data: ents, error } = await supabase.from('entities').select('id, name, ico').eq('ico', OLD_ICO);
  if (error) { console.log('ERR: ' + error.message); return; }
  if (!ents.length) {
    // idempotentné: možno už opravené — over či cieľ existuje
    const { data: done } = await supabase.from('entities').select('id, name, ico').eq('ico', NEW_ICO);
    console.log('SKIP: entita s IČO ' + OLD_ICO + ' už neexistuje. Cieľ ' + NEW_ICO + ' count=' + (done ? done.length : 0) + ' (idempotentné).');
    return;
  }
  if (ents.length > 1) { console.log('ABORT: viac než 1 entita s IČO ' + OLD_ICO + ' — ručne.'); return; }
  const e = ents[0];
  console.log(`Nájdená entita id=${e.id} name="${e.name}" ico=${e.ico}`);
  if (!/archeo/i.test(e.name || '')) { console.log('ABORT: názov neobsahuje ARCHEO — guard.'); return; }

  const { data: conflict, error: cErr } = await supabase.from('entities').select('id, name, ico').eq('ico', NEW_ICO);
  if (cErr) { console.log('ERR conflict check: ' + cErr.message); return; }
  if (conflict && conflict.length) {
    console.log('ABORT: už existuje entita s cieľovým IČO ' + NEW_ICO + ' -> nutný MERGE, nie prosté update:');
    conflict.forEach(c => console.log(`   id=${c.id} name="${c.name}"`));
    return;
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] zmenil by som ico ${OLD_ICO} -> ${NEW_ICO} na entite ${e.id} (názov ostáva "${e.name}"). Spusti s --apply.`);
    return;
  }
  const { error: upErr } = await supabase.from('entities').update({ ico: NEW_ICO }).eq('id', e.id);
  if (upErr) { console.log('ERR update: ' + upErr.message); return; }
  console.log(`[APPLY] Opravené: entita ${e.id} ico ${OLD_ICO} -> ${NEW_ICO}.`);
})().catch(e => console.log('FATAL: ' + e.message));
