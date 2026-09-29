// READ-ONLY WATCH #286 — 2-zdrojové overenie 12 NEPOKRYTÝCH malformed IČO (mimo ICO_CORRECTIONS).
// Pre KAŽDÝ kandidát: (1) RPO ŠÚ SR na zero-pad/strip variant -> reálny názov; (2) RPO na RAW
// číslice (pasca "strip -> cudzí subjekt" z entity-ico-fixes.ts); (3) DB názov kanonickej clean
// entity pri kolízii. Cieľ: rozhodnúť, ktoré sú bezpečná SK zero-pad oprava (merge) a ktoré sú
// cudzí/zahraničný subjekt čo sa NESMIE nútene opraviť. Nič nemení v DB.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 12 nepokrytých malformed IČO (SLOVES multi vynechaný — známy neopraviteľný, guard drží).
// pad = navrhovaný SK 8-cifr variant (zero-pad short6/7, strip whitespace); null = necháme na overenie.
const CAND = [
  { raw: '585441', db: 'KOOPERATIVA poisťovňa, a.s. Vienna Insurance Group', pad: '00585441', canon: '00585441' },
  { raw: '316792', db: 'Mesto Martin', pad: '00316792', canon: '00316792' },
  { raw: '685852', db: 'Messer Tatragas, spol. s r.o.', pad: '00685852', canon: '00685852' },
  { raw: '5143763', db: 'Dmitrij Marjov', pad: '05143763', canon: null },
  { raw: '2082870', db: 'Online Empire s. r. o.', pad: '02082870', canon: null },
  { raw: '151653', db: 'Slovenská sporiteľňa, a.s.', pad: '00151653', canon: '00151653' },
  { raw: '2852152', db: 'Beryko s. r. o.', pad: '02852152', canon: null },
  { raw: '275601', db: 'Oponeo.PL S.A.', pad: '00275601', canon: null },
  { raw: '912293', db: 'Ing. Milan Midžiak - znalec', pad: '00912293', canon: null },
  { raw: '684864', db: '(bez názvu)', pad: '00684864', canon: null },
  { raw: '2117968', db: 'Serif Ltd', pad: '02117968', canon: null },
  { raw: '587311', db: 'ROSFIX HUBERT GRZYBEK', pad: '00587311', canon: null },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rpo(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { http: res.status, names: [] };
    const d = await res.json();
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => String(i.value) === String(ico)));
    const names = [];
    exact.forEach(x => (x.fullNames || []).forEach(n => names.push(n.value)));
    return { http: 200, exactCount: exact.length, names };
  } catch (e) { return { http: 'ERR', err: e.message, names: [] }; }
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\s\-"']/g, '').replace(/spolsro|sro|as|ao/g, '');
}

(async () => {
  const out = [];
  for (const c of CAND) {
    // 1) RPO na pad variant
    const padR = await rpo(c.pad); await sleep(400);
    // 2) RPO na RAW ako 8-cifr strip (pasca) — len ak sa dá spraviť 8-cifr inak než pad
    const rawStrip = c.raw.replace(/\D/g, '');
    let rawR = null;
    if (rawStrip.length === 8 && rawStrip !== c.pad) { rawR = await rpo(rawStrip); await sleep(400); }
    // 3) DB kanonická clean entita (ak kolízia)
    let canonName = null, canonTx = null;
    if (c.canon) {
      const { data: ce } = await sb.from('entities').select('id,name,ico').eq('ico', c.canon).limit(1);
      if (ce && ce.length) {
        canonName = ce[0].name;
        const { count } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_entity_id', ce[0].id);
        canonTx = count;
      }
    }
    // verdikt
    const padMatch = padR.names.some(n => { const nn = norm(n), nd = norm(c.db); return nn.includes(nd) || nd.includes(nn); });
    let verdict;
    if (padR.exactCount > 0 && padMatch) verdict = 'SK_ZEROPAD_OK'; // pad IČO existuje v RPO a názov sedí
    else if (padR.exactCount > 0 && !padMatch) verdict = 'PAD_CUDZI_SUBJEKT'; // pad existuje ale iný názov -> pasca!
    else verdict = 'PAD_NENAJDENE'; // pad v RPO neexistuje -> pravdepodobne zahranicny/osobitny
    out.push({
      raw: c.raw, db: c.db, pad: c.pad, verdict,
      pad_rpo_exact: padR.exactCount, pad_rpo_names: padR.names,
      raw_strip: (rawStrip !== c.pad ? rawStrip : null), raw_rpo_names: rawR ? rawR.names : null,
      canon: c.canon, canon_db_name: canonName, canon_db_tx: canonTx,
    });
    console.log(`${verdict}\t"${c.raw}" (${c.db})\n  pad ${c.pad} RPO(exact=${padR.exactCount}): ${padR.names.join(' | ') || '—'}${rawR ? `\n  raw ${rawStrip} RPO: ${rawR.names.join(' | ') || '—'}` : ''}${c.canon ? `\n  canon DB ${c.canon}: "${canonName}" (tx=${canonTx})` : ''}`);
  }
  fs.writeFileSync('.audit/WATCH286_malformed_verify.json', JSON.stringify(out, null, 2));
  const sk = out.filter(o => o.verdict === 'SK_ZEROPAD_OK');
  const trap = out.filter(o => o.verdict === 'PAD_CUDZI_SUBJEKT');
  const fx = out.filter(o => o.verdict === 'PAD_NENAJDENE');
  console.log(`\n=== SUMÁR: SK_ZEROPAD_OK=${sk.length} | PAD_CUDZI_SUBJEKT(pasca)=${trap.length} | PAD_NENAJDENE(zahr/osobitne)=${fx.length} ===`);
  console.log('SK zero-pad bezpečné:', sk.map(o => o.raw + '->' + o.pad).join(', ') || '—');
  if (trap.length) console.log('PASCA (pad vedie na cudzí subjekt):', trap.map(o => o.raw + '->' + o.pad + '=' + o.pad_rpo_names.join('/')).join(', '));
})().catch(e => console.log('FATAL: ' + e.message));
