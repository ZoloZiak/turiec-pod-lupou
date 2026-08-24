// FIX: DV-ICO-ALL davka 0-39 nezhody (2026-08-24). Idempotentny, dry-run default, --apply na zapis.
// Zmeny overene 2 zdrojmi (RPO api.statistics.sk + web/registeruz/finstat):
//  - 00216822 -> 00316822 Obec Nolcovo (prehodena cislica; RPO: Obec Nolcovo)
//  - 00177474 nazov -> "Dobrovoľná požiarna ochrana Slovenskej republiky" (RPO celý názov)
//  - 00316806 nazov -> "Obec Mošovce" (adresa zlepena s nazvom v DB)
//  - 00316997 nazv -> "Obec Turčianska Štiavnička" (adresa zlepena s nazvom v DB)
//  - 00365327 nazv -> "Univerzitná nemocnica Martin" (RPO aktualny nazov od 2010-07-01)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FIXES = [
  { match: { ico: '00216822' }, set: { ico: '00316822', name: 'Obec Nolčovo' }, why: 'zle ICO (prehodena cislica), RPO 00216822=prazdne, 00316822=Obec Nolcovo' },
  { match: { ico: '00177474' }, set: { name: 'Dobrovoľná požiarna ochrana Slovenskej republiky' }, why: 'RPO cely nazov' },
  { match: { ico: '00316806' }, set: { name: 'Obec Mošovce' }, why: 'adresa zlepena s nazvom' },
  { match: { ico: '00316997' }, set: { name: 'Obec Turčianska Štiavnička' }, why: 'adresa zlepena s nazvom' },
  { match: { ico: '00365327' }, set: { name: 'Univerzitná nemocnica Martin' }, why: 'RPO aktualny nazov od 2010' },
];

(async () => {
  let changed = 0;
  for (const f of FIXES) {
    const { data, error } = await supabase.from('entities').select('id,name,ico').match(f.match);
    if (error) { console.error('READ chyba', f.match, error.message); process.exit(1); }
    if (!data || data.length === 0) {
      console.log(`SKIP ${f.match.ico} — uz opravene alebo nenajdene (idempotentny beh)`);
      continue;
    }
    for (const row of data) {
      const needs = Object.entries(f.set).some(([k, v]) => row[k] !== v);
      if (!needs) { console.log(`SKIP id=${row.id} ${row.ico} — uz sedi`); continue; }
      console.log(`${APPLY ? 'APPLY' : 'DRY '} entities id=${row.id}: "${row.name}" (${row.ico}) ->`, JSON.stringify(f.set), `| ${f.why}`);
      if (APPLY) {
        const { error: uerr } = await supabase.from('entities').update(f.set).eq('id', row.id);
        if (uerr) { console.error('UPDATE chyba:', uerr.message); process.exit(1); }
      }
      changed++;
    }
  }
  console.log(APPLY ? `HOTOVO: upravenych ${changed} riadkov.` : `DRY-RUN: zmien by bolo ${changed}. Spusti s --apply.`);
})();
