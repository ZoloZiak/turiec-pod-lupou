const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * DIAGNOSE-ONLY audit dodávateľských IČO. NIKDY nezapisuje do DB.
 * Krížovo overuje IČO->názov cez DVA registre (RÚZ registeruz.sk + RPO ŠÚ SR)
 * a klasifikuje každý subjekt. Výsledok -> .audit/icos_candidates.json.
 *
 * Prečo diagnose-only: bezpečné auto-nájdenie SPRÁVNEHO IČO pre zle-uvedený
 * subjekt sa cez registre spoľahlivo nedá (RÚZ nazov= nefiltruje). Preto tu
 * len KLASIFIKUJEME; skutočnú opravu robí človek/cielený migračný skript
 * (vzor migrate_swapped_icos.js: dry-run -> apply) len na vysoko-istých zhodách.
 *
 * Klasifikácia:
 *  OK          - RÚZ/RPO názov sa po normalizácii zhoduje (líši sa len právna forma/medzery/diakritika).
 *  FORMAT_ONLY - drobný rozdiel v písaní, ten istý subjekt (nemeniť).
 *  MISMATCH    - IČO patrí PREUKÁZATEĽNE inému subjektu (oba registre sa zhodujú na inom mene). Kandidát na ručnú opravu.
 *  NOT_FOUND   - IČO v ani jednom registri (možný preklep). Kandidát na ručnú kontrolu.
 *  API_ERR     - dočasná chyba, preveriť neskôr.
 */
const fetchFn = global.fetch;

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')            // diakritika
    .replace(/&quot;|&amp;|"|'|,|\./g, ' ')
    .replace(/\b(s\s*r\s*o|a\s*s|spol|k\s*s|v\s*o\s*s|o\s*z|n\s*o|akciova spolocnost|spolocnost)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function coreWords(s) {
  return norm(s).split(' ').filter(w => w.length >= 3);
}
function sameSubject(a, b) {
  const wa = coreWords(a), wb = new Set(coreWords(b));
  if (!wa.length) return false;
  const hit = wa.filter(w => wb.has(w)).length;
  return hit / wa.length >= 0.5;   // väčšina jadrových slov sa zhoduje
}

async function ruzName(ico) {
  try {
    const r = await fetchFn(`https://www.registeruz.sk/cruz-public/api/uctovne-jednotky?ico=${ico}&zmenene-od=2005-01-01`);
    if (!r.ok) return { err: 'ruz http ' + r.status };
    const j = await r.json();
    if (!j.id || !j.id.length) return { name: null };
    const d = await (await fetchFn(`https://www.registeruz.sk/cruz-public/api/uctovna-jednotka?id=${j.id[0]}`)).json();
    return { name: d.nazovUJ || null };
  } catch (e) { return { err: e.message }; }
}
async function rpoName(ico) {
  try {
    const r = await fetchFn(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`);
    if (!r.ok) return { err: 'rpo http ' + r.status };
    const j = await r.json();
    for (const e of (j.results || [])) {
      for (const idf of (e.identifiers || [])) {
        if (idf.value === ico) return { name: (e.fullNames || [{}])[0].value || null };
      }
    }
    return { name: null };
  } catch (e) { return { err: e.message }; }
}

async function run() {
  const { data: entities, error } = await supabase.from('entities').select('id, name, ico').order('name');
  if (error) { console.error('DB:', error.message); process.exit(1); }
  const real = entities.filter(e => e.ico && !e.ico.startsWith('NO_ICO_') && /^\d{8}$/.test(e.ico));
  console.log(`Preverujem ${real.length} entít (diagnose-only, 2 registre)...`);

  const out = { generated: new Date().toISOString(), total: real.length, ok: 0, format_only: [], mismatch: [], not_found: [], api_err: [] };
  const B = 10;
  for (let i = 0; i < real.length; i += B) {
    await Promise.all(real.slice(i, i + B).map(async (e) => {
      const ruz = await ruzName(e.ico);
      const rpo = await rpoName(e.ico);
      const names = [ruz.name, rpo.name].filter(Boolean);
      if (ruz.err && rpo.err) { out.api_err.push({ ico: e.ico, db: e.name, ruz: ruz.err, rpo: rpo.err }); return; }
      if (!names.length) { out.not_found.push({ ico: e.ico, db: e.name }); return; }
      const anyMatch = names.some(n => sameSubject(e.name, n) || sameSubject(n, e.name));
      if (anyMatch) {
        const exact = names.some(n => norm(n) === norm(e.name));
        if (exact) out.ok++;
        else out.format_only.push({ ico: e.ico, db: e.name, reg: names });
      } else {
        out.mismatch.push({ ico: e.ico, db: e.name, ruz: ruz.name || null, rpo: rpo.name || null });
      }
    }));
    if (i % 50 === 0) console.log(`  ${i}/${real.length}`);
    await new Promise(r => setTimeout(r, 120));
  }

  const fs = require('fs');
  const path = require('path');
  const dir = path.join(process.cwd(), '.audit');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'icos_candidates.json'), JSON.stringify(out, null, 2));
  console.log(`\nHOTOVO. ok=${out.ok} format_only=${out.format_only.length} MISMATCH=${out.mismatch.length} not_found=${out.not_found.length} api_err=${out.api_err.length}`);
  console.log('Výsledok: .audit/icos_candidates.json (ŽIADNE DB zmeny). MISMATCH/not_found preveriť ručne — NEauto-fixovať bulk.');
}
run();
