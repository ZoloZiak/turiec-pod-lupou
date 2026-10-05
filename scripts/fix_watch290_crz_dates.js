#!/usr/bin/env node
// WATCH #290 data backfill — oprava date_published pre CRZ zmluvy so "stamp-dátumom behu".
// Root cause (opravený v src/scripts/krtko-crz.ts commit a34fe6e): scraper default new Date()
// a regex na "Dátum zverejnenia" nematchol nový CRZ markup -> ~1362 z 2274 zmlúv dostalo dátum
// behu (2026-08-03:864, 2026-08-02:267, 2026-10-05:231) namiesto reálneho zverejnenia.
//
// Tento skript: pre CRZ zmluvy s date_published v STAMP_DATES (dátumy behu) re-fetchne reálny
// "Dátum zverejnenia" z crz.gov.sk/zmluva/<id>/ a opraví DB.
// BEZPEČNOSŤ:
//  - default dry-run; --apply vykoná update.
//  - mení LEN ak CRZ vráti platný dátum A líši sa od DB. Fetch fail / nenájdený dátum = LOG+SKIP
//    (nič sa nevymýšľa; stamp dátum sa radšej ponechá než nahradí hádaným).
//  - idempotentné: po oprave už date_published nie je v STAMP_DATES -> riadok sa znova nespracuje.
//  - --limit N obmedzí počet (dávkovanie); --cursor N preskočí prvých N (ale set berieme zoradený
//    deterministicky podľa external_id, takže dávky sú stabilné).
// usage: node scripts/fix_watch290_crz_dates.js [--apply] [--limit N] [--cursor N]
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APPLY = process.argv.includes('--apply');
const limArg = process.argv.find(a => a.startsWith('--limit='));
const curArg = process.argv.find(a => a.startsWith('--cursor='));
const LIMIT = limArg ? parseInt(limArg.split('=')[1], 10) : Infinity;
const CURSOR = curArg ? parseInt(curArg.split('=')[1], 10) : 0;

// Dátumy behu scrapera (nie reálne zverejnenia) — cluster z diag_watch290_datedist.js.
const STAMP_DATES = ['2026-08-03', '2026-08-02', '2026-10-05'];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseCrzDate(html) {
  // 1) label v <strong>, dátum v nasledujúcom <span>
  let m = html.match(/Dátum zverejnenia:\s*<\/strong>[\s\S]{0,200}?(\d{2})\.(\d{2})\.(\d{4})/i);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // 2) všeobecný fallback: label + do 120 znakov tagov + dátum
  m = html.match(/Dátum zverejnenia:[\s\S]{0,120}?(\d{2})\.(\d{2})\.(\d{4})/i);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

async function fetchStampRows() {
  const rows = [];
  for (const d of STAMP_DATES) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('transactions')
        .select('id, external_id, source_url, date_published, subject')
        .eq('source_type', 'CRZ_CONTRACT').eq('date_published', d)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
  }
  rows.sort((a, b) => a.external_id.localeCompare(b.external_id));
  return rows;
}

async function main() {
  const all = await fetchStampRows();
  console.log(`STAMP zmlúv celkom: ${all.length} (dátumy: ${STAMP_DATES.join(', ')})`);
  const slice = all.slice(CURSOR, CURSOR === 0 && LIMIT === Infinity ? undefined : CURSOR + LIMIT);
  console.log(`Spracúvam okno [${CURSOR}..${CURSOR + slice.length - 1}] = ${slice.length} zmlúv. APPLY=${APPLY}`);

  let fixed = 0, same = 0, skipFetch = 0, skipNoDate = 0, errUpd = 0;
  const changes = [];
  for (const row of slice) {
    const idMatch = (row.external_id || '').match(/crz_(\d+)/);
    if (!idMatch) { skipFetch++; console.log(`SKIP (zlý external_id): ${row.external_id}`); continue; }
    const url = `https://crz.gov.sk/zmluva/${idMatch[1]}/`;
    let html;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { skipFetch++; console.log(`SKIP (HTTP ${res.status}): ${row.external_id}`); await sleep(200); continue; }
      html = await res.text();
    } catch (e) {
      skipFetch++; console.log(`SKIP (fetch err ${e.message}): ${row.external_id}`); await sleep(200); continue;
    }
    const realDate = parseCrzDate(html);
    if (!realDate) { skipNoDate++; console.log(`SKIP (dátum nenájdený v CRZ HTML): ${row.external_id}`); await sleep(150); continue; }
    if (realDate === row.date_published) { same++; await sleep(120); continue; }
    changes.push({ id: row.id, external_id: row.external_id, from: row.date_published, to: realDate });
    console.log(`${APPLY ? 'FIX' : 'DRY'} ${row.external_id}: ${row.date_published} -> ${realDate}`);
    if (APPLY) {
      const { error: uErr } = await supabase.from('transactions').update({ date_published: realDate }).eq('id', row.id);
      if (uErr) { errUpd++; console.log(`  UPDATE ERR: ${uErr.message}`); } else { fixed++; }
    }
    await sleep(150);
  }

  console.log(`\n=== SUMÁR okno [${CURSOR}..${CURSOR + slice.length - 1}] ===`);
  console.log(`na opravu: ${changes.length}, ${APPLY ? `APLIKOVANÉ: ${fixed}, update-err: ${errUpd}` : '(dry-run)'}`);
  console.log(`už sedí (stamp==real, žiadna zmena): ${same}, skip fetch: ${skipFetch}, skip no-date: ${skipNoDate}`);
  const fs = require('fs');
  fs.writeFileSync(`.audit/WATCH290_dates_${CURSOR}_${APPLY ? 'apply' : 'dry'}.json`, JSON.stringify({ total: all.length, window: [CURSOR, CURSOR + slice.length], changes, same, skipFetch, skipNoDate, fixed, errUpd }, null, 1));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
