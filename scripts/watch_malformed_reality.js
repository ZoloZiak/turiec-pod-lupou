// READ-ONLY WATCH #89: pre KAŽDÉ malformed IČO (Krtko cez noc) zisti REÁLNE IČO subjektu
// z CRZ detailu (source_url) + over v RPO ŠÚ SR. Cieľ: zistiť, ktoré sa dajú bezpečne
// opraviť read-time correction (strip==CRZ==RPO) a ktoré NIE (ako BTI, kde strip vedie na cudzí subjekt).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[.,\s\-"']/g, '').replace(/spolsro|sro|as|ao|akciovaspolocnost/g, '');

// Vyparsuj z CRZ HTML dvojice (label, ico, name) pre Dodávateľ + Objednávateľ.
function parseCrz(html) {
  const out = {};
  // Objednávateľ blok
  const dodMatch = html.match(/Dodávateľ:\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
  const objMatch = html.match(/Objednávateľ:\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
  if (dodMatch) out.dodName = dodMatch[1].trim();
  if (objMatch) out.objName = objMatch[1].trim();
  // všetky IČO v poradí výskytu (8-cifr)
  out.allIco = [...html.matchAll(/IČO:\s*<\/strong>\s*<span[^>]*>\s*(\d[\d\s]{5,})\s*</gi)]
    .map(m => m[1].replace(/\s+/g, ''));
  return out;
}

async function rpoName(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    const d = await res.json();
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
    if (!exact.length) return null;
    return [...new Set(exact.flatMap(x => (x.fullNames || []).map(n => n.value)))];
  } catch (e) { return 'ERR:' + e.message.slice(0, 40); }
}

(async () => {
  const mal = JSON.parse(fs.readFileSync('.audit/WATCH_ico_malformed_impact.json', 'utf8'));
  const results = [];
  for (const m of mal) {
    const stripped = String(m.ico).replace(/\s+/g, '');
    const url = m.sample && m.sample.source_url;
    const r = { ico: m.ico, name: m.name, stripped, category: m.category, collision: m.collision, url, crz: null, real_ico: null, strip_ok: null, rpo_strip: null, rpo_real: null };
    if (url && /crz\.gov\.sk/.test(url)) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        const html = await res.text();
        const p = parseCrz(html);
        r.crz = p;
        // ktorá strana zodpovedá DB name?
        const target = norm(m.name);
        let matchedSide = null;
        if (p.dodName && (norm(p.dodName).includes(target) || target.includes(norm(p.dodName)))) matchedSide = 'dod';
        else if (p.objName && (norm(p.objName).includes(target) || target.includes(norm(p.objName)))) matchedSide = 'obj';
        r.matchedSide = matchedSide;
        // CRZ štruktúra: allIco[0] = objednávateľ, allIco[1] = dodávateľ (podľa poradia blokov)
        if (p.allIco && p.allIco.length >= 2) {
          const objIco = p.allIco[0], dodIco = p.allIco[1];
          r.crz_obj_ico = objIco; r.crz_dod_ico = dodIco;
          if (matchedSide === 'dod') r.real_ico = dodIco;
          else if (matchedSide === 'obj') r.real_ico = objIco;
        }
        r.strip_ok = r.real_ico ? (stripped === r.real_ico) : null;
      } catch (e) { r.crz_err = e.message.slice(0, 60); }
      await sleep(400);
    }
    if (/^\d{8}$/.test(stripped)) { r.rpo_strip = await rpoName(stripped); await sleep(300); }
    if (r.real_ico && r.real_ico !== stripped) { r.rpo_real = await rpoName(r.real_ico); await sleep(300); }
    results.push(r);
    console.log(`[${r.category}] "${m.ico}" strip=${stripped} real=${r.real_ico || '?'} strip_ok=${r.strip_ok} coll=${m.collision} | ${m.name}`);
  }
  fs.writeFileSync('.audit/WATCH89_malformed_reality.json', JSON.stringify(results, null, 2));
  console.log('\n=== VERDIKTY ===');
  for (const r of results) {
    const rpoS = Array.isArray(r.rpo_strip) ? r.rpo_strip.join('/') : r.rpo_strip;
    console.log(`"${r.ico}" -> real=${r.real_ico || '?'} strip_ok=${r.strip_ok} | RPO(strip ${r.stripped})=${rpoS} | ${r.name}`);
  }
})();
