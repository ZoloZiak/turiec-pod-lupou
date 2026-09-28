// WATCH #278 — oprava preklepu v názve entity IČO 30796491:
//   "Enviromentálny fond" -> "Environmentálny fond"
// 2-zdrojovo overené (RPO ŠÚ SR + RÚZ + CRZ detail zmluvy 10167955 = "Environmentálny fond").
// CRZ zdroj má SPRÁVNY pravopis -> žiadne whack-a-mole riziko. Právnická osoba (štátny fond),
// nie fyzická -> poistka menovaných osôb sa neuplatňuje. Len oprava pravopisu, žiadne obvinenie.
// Idempotentný: keyed na IČO + starý (chybný) názov -> po oprave = NO-OP.
// Použitie: node scripts/fix_envfond_typo.js          (dry-run)
//           node scripts/fix_envfond_typo.js --apply   (zápis)
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ICO = '30796491';
const OLD = 'Enviromentálny fond';
const NEW = 'Environmentálny fond';
const APPLY = process.argv.includes('--apply');

(async () => {
  // celý riadok, nech vidím všetky stĺpce s názvom (name / normalized / atď.)
  const { data: rows, error } = await supabase.from('entities').select('*').eq('ico', ICO);
  if (error) { console.log('DB chyba:', error.message); process.exit(1); }
  console.log('CELÝ riadok entity (všetky stĺpce):', JSON.stringify(rows, null, 1));

  const target = (rows || []).filter(r => r.name === OLD);
  if (!target.length) { console.log(`\nNO-OP: žiadna entita IČO ${ICO} s názvom "${OLD}" (už opravené alebo nič).`); return; }
  console.log(`\nNájdených ${target.length} na opravu: name "${OLD}" -> "${NEW}"`);

  if (!APPLY) { console.log('DRY-RUN (bez --apply): nič sa nezapísalo (opraví sa name + normalized_name).'); return; }
  const NEW_NORM = NEW.toLowerCase();
  for (const t of target) {
    const { error: uerr } = await supabase.from('entities').update({ name: NEW, normalized_name: NEW_NORM }).eq('id', t.id).eq('name', OLD);
    if (uerr) { console.log(`  CHYBA update id=${t.id}:`, uerr.message); }
    else console.log(`  OPRAVENÉ id=${t.id}: name+normalized_name "${OLD}" -> "${NEW}"`);
  }
  const { data: after } = await supabase.from('entities').select('id, name, ico').eq('ico', ICO);
  console.log('\nPO OPRAVE:', JSON.stringify(after, null, 1));
})().catch(e => console.log('FATAL: ' + e.message));
