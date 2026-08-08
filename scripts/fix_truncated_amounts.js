#!/usr/bin/env node
/**
 * fix_truncated_amounts.js
 *
 * Oprava systematicky useknutych sum CRZ zmluv.
 * PRICINA BUGU (uz opravena v scraperi src/scripts/krtko-crz.ts): dvojity backslash
 * v replace(/\s/) => literalny \s => tisicove medzery sa NEodstranili => parseFloat
 * zastane na medzere => "107 632,50" ulozene ako 107. KAZDA suma > 999 € useknuta.
 *
 * Tento skript pre kazdu podozrivu zmluvu (amount_eur < 1000) stiahne CRZ detail,
 * vyparsuje REALNU sumu a opravi ju. NIKDY nevymysla sumu — len co realne najde v HTML.
 *
 * Pouzitie:
 *   node scripts/fix_truncated_amounts.js           # dry-run (default, nic nemeni)
 *   node scripts/fix_truncated_amounts.js --apply    # vykona UPDATE amount_eur
 *
 * Idempotentne: opakovane spustenie uz nenajde opravene (padnu mimo amount<1000).
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Chýbajú Supabase kľúče (.env.local)!');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APPLY = process.argv.includes('--apply');
const THROTTLE_MS = 150;
const UA = 'Mozilla/5.0 (compatible; turiec-pod-lupou-fix/1.0)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function crzIdFrom(tx) {
  // z external_id 'crz_<ID>' alebo zo source_url '.../zmluva/<ID>/'
  let m = (tx.external_id || '').match(/crz_(\d+)/i);
  if (m) return m[1];
  m = (tx.source_url || '').match(/zmluva\/(\d+)/i);
  if (m) return m[1];
  return null;
}

/**
 * Vyparsuje realnu (najvacsiu) sumu z CRZ detail HTML.
 * CRZ format: "107 632,50 €" (medzera/NBSP = tisicovy oddelovac, ciarka = desatiny).
 * Vrati Number alebo null ak sa nenaslo nic.
 */
function parseAmountFromHtml(html) {
  // normalizuj NBSP a &nbsp; na obycajnu medzeru, &euro; -> €
  const norm = html
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€');
  // najdi vsetky "cislo s tisicovymi medzerami a ,XX" nasledovane € alebo EUR
  const re = /([0-9][0-9\s]*,[0-9]{2})\s*(?:€|EUR)/g;
  let match;
  let best = null;
  while ((match = re.exec(norm)) !== null) {
    const raw = match[1];
    const val = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val) && (best === null || val > best)) best = val;
  }
  return best;
}

async function fetchDetail(crzId) {
  const url = `https://crz.gov.sk/zmluva/${crzId}/`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        if (attempt === 0) { await sleep(400); continue; }
        return { ok: false, reason: `HTTP ${res.status}` };
      }
      const html = await res.text();
      return { ok: true, html };
    } catch (err) {
      if (attempt === 0) { await sleep(400); continue; }
      return { ok: false, reason: err.message };
    }
  }
  return { ok: false, reason: 'unreachable' };
}

async function main() {
  console.log(`\n=== fix_truncated_amounts.js — ${APPLY ? 'APPLY (zapisuje)' : 'DRY-RUN (nic nemeni)'} ===\n`);

  // Nacitaj VSETKYCH kandidatov (amount_eur < 1000, vratane 0) — strankovanie kvoli limitu 1000
  let candidates = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, external_id, amount_eur, source_url')
      .eq('source_type', 'CRZ_CONTRACT')
      .lt('amount_eur', 1000)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('Chyba pri nacitani:', error.message); process.exit(1); }
    candidates = candidates.concat(data);
    if (data.length < PAGE) break;
  }

  console.log(`Kandidatov (CRZ_CONTRACT, amount_eur < 1000): ${candidates.length}\n`);

  const toFix = [];      // { tx, oldAmount, newAmount }
  const unavailable = []; // { id, crzId, reason }
  let matched = 0;        // suma sedela (bez zmeny)
  let noId = 0;
  let i = 0;

  for (const tx of candidates) {
    i++;
    const crzId = crzIdFrom(tx);
    if (!crzId) { noId++; unavailable.push({ id: tx.id, crzId: null, reason: 'ziadne CRZ_ID' }); continue; }

    const det = await fetchDetail(crzId);
    await sleep(THROTTLE_MS);

    if (!det.ok) { unavailable.push({ id: tx.id, crzId, reason: det.reason }); continue; }

    const real = parseAmountFromHtml(det.html);
    if (real === null) { unavailable.push({ id: tx.id, crzId, reason: 'suma v detaile nenajdena' }); continue; }

    const old = Number(tx.amount_eur) || 0;
    if (Math.abs(real - old) > 0.01) {
      toFix.push({ tx, oldAmount: old, newAmount: real, crzId });
    } else {
      matched++;
    }

    if (i % 100 === 0) console.log(`  ... spracovanych ${i}/${candidates.length} (na opravu: ${toFix.length}, nedostupnych: ${unavailable.length})`);
  }

  console.log(`\n--- SUHRN ---`);
  console.log(`Kandidatov spolu:        ${candidates.length}`);
  console.log(`Na opravu (lisi sa):     ${toFix.length}`);
  console.log(`Suma sedela (bez zmeny): ${matched}`);
  console.log(`Nedostupnych/bez sumy:   ${unavailable.length}`);
  console.log(`Bez CRZ_ID:              ${noId}`);

  console.log(`\nUkazka 20 na opravu (crzId | stara -> nova):`);
  toFix.slice(0, 20).forEach((f) => console.log(`  crz_${f.crzId} | ${f.oldAmount} -> ${f.newAmount}`));

  if (unavailable.length) {
    console.log(`\nUkazka 10 nedostupnych/bez sumy:`);
    unavailable.slice(0, 10).forEach((u) => console.log(`  ${u.id} (crz_${u.crzId}) — ${u.reason}`));
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Nic sa nezapisalo. Pre vykonanie spusti s --apply\n`);
    return { toFix, matched, unavailable, candidates: candidates.length };
  }

  // APPLY: vykonaj update
  console.log(`\n[APPLY] Zapisujem ${toFix.length} opravenych sum...`);
  let updated = 0, updErr = 0;
  for (const f of toFix) {
    const { error } = await supabase
      .from('transactions')
      .update({ amount_eur: f.newAmount })
      .eq('id', f.tx.id);
    if (error) { updErr++; console.error(`  CHYBA update ${f.tx.id}: ${error.message}`); }
    else updated++;
  }
  console.log(`\n[APPLY] Aktualizovanych: ${updated}, chyb: ${updErr}\n`);
  return { toFix, matched, unavailable, candidates: candidates.length, updated, updErr };
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
