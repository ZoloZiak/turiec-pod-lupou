// WATCH #257 (IČO stráž, okno 280-299 + delta) — oprava CHYBNÉHO IČO (typo v CRZ zdroji).
// DB entita name="Metrostav DS a.s." má ico="4612602" (7 cifier) — v RPO ŠÚ SR NEEXISTUJE
// (ani po zero-pade "04612602"). Reálne IČO firmy Metrostav DS a.s. = 46120602, overené 3-zdrojovo:
//   (1) RPO ŠÚ SR fullName="Metrostav DS" -> identifier 46120602, adresa Košická 17180/49,
//       821 08 Bratislava-Ružinov, obchodné meno história: Doprastav Asfalt a.s. -> Metrostav
//       Asfalt a.s. -> Metrostav DS a.s. (od 2019-11-15), aktívna od 2011-04-01;
//   (2) CRZ detail zmluvy 12780443 (Rámcová dohoda č. 03/JŠ2026, opravy ciest, 929 406,23 €):
//       Dodávateľ "Metrostav DS a.s., Košická 17180/49, 821 08 Bratislava-Ružinov" — adresa
//       PRESNE sedí s RPO; CRZ uvádza IČO "4612602" = typo (chýba 0 na 5. pozícii: 46120602);
//   (3) RÚZ registeruz.sk ico=46120602 -> účtovná jednotka id 1129902.
// Typo vzor identický s Nolčovo (#253) — NIE zero-pad (04612602 v RPO prázdne). Entita má
// 1 reálnu supplier tx (crz_12780443, 929 406,23 €) -> NEMAZAŤ, ale OPRAVIŤ IČO 4612602 -> 46120602.
// Idempotentný: dry-run default, --apply vykoná. Guard: mení LEN ak existuje práve 1 entita s
// ico=4612602 A name obsahuje "Metrostav" A v DB NIE je konfliktná entita s cieľovým ico=46120602.
// Firemná entita (a.s.) -> poistka menovaných osôb sa neuplatňuje (len oprava párovania na reálne IČO).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const OLD_ICO = '4612602';
const NEW_ICO = '46120602';

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
  if (!/metrostav/i.test(e.name || '')) { console.log('ABORT: názov neobsahuje "Metrostav" — guard.'); return; }

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
