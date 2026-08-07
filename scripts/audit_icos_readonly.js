// READ-ONLY audit vsetkych dodavatelskych ICO cez RPO SU SR (api.statistics.sk).
// Nic nemeni v DB. Vypise JSON report do .audit/icos_report.json + citatelny log na stdout.
// Pouzitie: node scripts/audit_icos_readonly.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) { console.error('Chybaju Supabase kluce!'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalize(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&quot;/g, '').replace(/&amp;/g, '&')
    .replace(/[",.\-]/g, ' ')
    .replace(/\b(s r o|a s|spol s r o|o z|k s|v o s|sro|as)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return normalize(s).split(' ').filter(w => w.length >= 3 && !['spol','pre','ako','the','and'].includes(w));
}

async function rpoLookup(ico) {
  const url = `https://api.statistics.sk/rpo/v1/search?identifier=${ico}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) return { http: res.status, results: null };
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  // ber LEN vysledok kde identifiers[].value === presne hladane ICO
  const exact = results.filter(r => Array.isArray(r.identifiers) && r.identifiers.some(id => String(id.value) === String(ico)));
  const pick = exact.length ? exact : results;
  const names = [];
  for (const r of pick) {
    if (Array.isArray(r.fullNames)) for (const n of r.fullNames) if (n && n.value) names.push(n.value);
  }
  return { http: 200, count: results.length, exactCount: exact.length, names };
}

(async () => {
  const { data: entities, error } = await supabase.from('entities').select('id, name, ico').order('name');
  if (error) { console.error('DB chyba:', error); process.exit(1); }
  const real = entities.filter(e => e.ico && !e.ico.startsWith('NO_ICO_') && /^\d{8}$/.test(e.ico));
  console.log(`Nacitanych ${real.length} entit s 8-miestnym ICO (z ${entities.length} celkovo).`);

  const report = { generated: new Date().toISOString(), total: real.length, ok: [], mismatch: [], notfound: [], apierr: [] };

  const BATCH = 8;
  for (let i = 0; i < real.length; i += BATCH) {
    const batch = real.slice(i, i + BATCH);
    await Promise.all(batch.map(async (e) => {
      try {
        const r = await rpoLookup(e.ico);
        if (r.http !== 200) { report.apierr.push({ ...e, http: r.http }); return; }
        if (!r.names || r.names.length === 0) { report.notfound.push({ ...e, note: 'RPO ziadny vysledok pre toto ICO' }); return; }
        const dbTok = tokens(e.name);
        const offNorm = r.names.map(normalize).join(' | ');
        const match = dbTok.length === 0 || dbTok.some(w => offNorm.includes(w));
        if (match) report.ok.push({ ico: e.ico, db: e.name, rpo: r.names[0] });
        else report.mismatch.push({ id: e.id, ico: e.ico, db: e.name, rpo: r.names, exactCount: r.exactCount });
      } catch (err) {
        report.apierr.push({ ...e, err: String(err && err.message || err) });
      }
    }));
    await sleep(150);
    if (i % 80 === 0) console.log(`  ...${i}/${real.length}`);
  }

  fs.writeFileSync('.audit/icos_report.json', JSON.stringify(report, null, 2));
  console.log('\n===== ZHRNUTIE =====');
  console.log(`OK (meno sedi):        ${report.ok.length}`);
  console.log(`NEZHODA (meno nesedi): ${report.mismatch.length}`);
  console.log(`NENAJDENE v RPO:       ${report.notfound.length}`);
  console.log(`API chyby:             ${report.apierr.length}`);
  console.log('\n--- NEZHODY ---');
  for (const m of report.mismatch) console.log(`ICO ${m.ico} | DB "${m.db}" | RPO "${(m.rpo||[]).join(' / ')}"`);
  console.log('\n--- NENAJDENE ---');
  for (const n of report.notfound) console.log(`ICO ${n.ico} | DB "${n.name}"`);
  console.log('\nReport ulozeny do .audit/icos_report.json');
})();
