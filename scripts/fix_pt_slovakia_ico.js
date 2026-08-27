// WATCH tik #54 (IČO stráž, okno 280-299) — oprava zameneného IČO.
// DB entita name="PT Slovakia Group s. r. o." má ico=52219763, ktoré v RPO ŠÚ SR patrí
// FYZ. OSOBE "Marek Hambalko" (živnostenský register, OÚ Šaľa, Trnovec nad Váhom) — NIE firme.
// Reálne IČO firmy PT Slovakia Group s. r. o. = 56250673 (RPO: Obchodný register OS Trnava,
// Sro/56731/T, Hody 1256, 92401 Galanta, vznik 2024-05-10), potvrdené CRZ detailom zmluvy
// 9711675 (Dodávateľ "PT Slovakia Group s. r. o.", Hody 1256, 924 01 Galanta; uzavretá 04.09.2024)
// + 5 nezávislých web zdrojov (azet/valida/register.peniaze/findat/transparex).
// Entita má 1 reálnu tx (crz_9711675, 11 952 €) -> NEMAZAŤ, ale OPRAVIŤ IČO 52219763 -> 56250673.
// Idempotentný: dry-run default, --apply vykoná. Guard: mení LEN ak existuje práve 1 entita s
// ico=52219763 A name obsahuje "PT Slovakia" A v DB NIE je konfliktná entita s cieľovým ico=56250673.
// Firemná entita -> poistka menovaných osôb sa neuplatňuje (len oprava nesprávneho párovania).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const OLD_ICO = '52219763';
const NEW_ICO = '56250673';

(async () => {
  const { data: ents, error } = await supabase.from('entities').select('id, name, ico').eq('ico', OLD_ICO);
  if (error) { console.log('ERR: ' + error.message); return; }
  if (!ents.length) {
    const { data: done } = await supabase.from('entities').select('id, name, ico').eq('ico', NEW_ICO);
    console.log('SKIP: entita s IČO ' + OLD_ICO + ' už neexistuje. Cieľ ' + NEW_ICO + ' count=' + (done ? done.length : 0) + ' (idempotentné).');
    return;
  }
  if (ents.length > 1) { console.log('ABORT: viac než 1 entita s IČO ' + OLD_ICO + ' — ručne.'); return; }
  const e = ents[0];
  console.log(`Nájdená entita id=${e.id} name="${e.name}" ico=${e.ico}`);
  if (!/pt\s*slovakia/i.test(e.name || '')) { console.log('ABORT: názov neobsahuje "PT Slovakia" — guard.'); return; }

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
