// WATCH #200: readonly re-verifikacia /slubomer proti realite.
// 1) promise source_url domeny (HTTP status), 2) vsetkych 28 related CRZ tx: HTTP status
//    + suma z CRZ HTML detailu porovnana s DB amount_eur (regresny vektor decimal-shift/useknuty-tisic).
// READ-ONLY. NODE_TLS_REJECT_UNAUTHORIZED=0 (MITM proxy v sieti).
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const UA = 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

async function head(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA }, signal: c.signal });
    clearTimeout(t);
    const body = await r.text();
    return { status: r.status, body };
  } catch (e) { return { status: 'ERR:' + e.message, body: '' }; }
}

// vytiahni "Zmluvne dohodnuta ciastka" / "Celkova ciastka" z CRZ HTML
function parseCrzAmount(html) {
  const out = [];
  const re = /(\d[\d\s\u00a0]*,\d{2})\s*€/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const norm = m[1].replace(/[\s\u00a0]/g, '').replace(',', '.');
    out.push(parseFloat(norm));
  }
  return out;
}

async function main() {
  const { data: promises } = await supabase.from('promises').select('*');
  // 1) promise domeny
  const domains = [...new Set((promises || []).map(p => p.source_url).filter(Boolean))];
  console.log('=== PROMISE SOURCE_URL DOMENY ===');
  for (const d of domains) {
    const r = await head(d);
    console.log(`${typeof r.status === 'number' ? 'HTTP ' + r.status : r.status}  ${d}`);
  }

  // 2) 28 related CRZ tx
  const txIds = [...new Set((promises || []).flatMap(p => p.related_transaction_ids || []))];
  const { data: txs } = await supabase.from('transactions').select('id, subject, amount_eur, source_url').in('id', txIds);
  console.log('\n=== ' + (txs || []).length + ' RELATED CRZ TX: HTTP + SUMA vs DB ===');
  let bad = 0, mismatch = 0;
  for (const t of (txs || [])) {
    const r = await head(t.source_url);
    if (typeof r.status !== 'number' || r.status !== 200) { bad++; console.log(`BAD ${r.status}  ${t.source_url}  (DB ${t.amount_eur})`); continue; }
    const amounts = parseCrzAmount(r.body);
    const db = Number(t.amount_eur) || 0;
    if (db === 0) {
      // realna nulova zmluva; over ze CRZ obsahuje 0,00 alebo ziadnu ciastku
      const hasZero = amounts.includes(0) || /0,00\s*€/.test(r.body);
      console.log(`OK   200  DB=0  crzHasZero=${hasZero}  ${t.source_url}`);
      continue;
    }
    const match = amounts.some(a => Math.abs(a - db) < 0.005);
    if (match) {
      console.log(`OK   200  DB=${db}  MATCH  ${t.source_url}`);
    } else {
      mismatch++;
      console.log(`MISMATCH 200  DB=${db}  crz=[${amounts.slice(0, 6).join(', ')}]  ${t.source_url}`);
    }
  }
  console.log('\n=== SUMMARY === domains=' + domains.length + ' tx=' + (txs || []).length + ' BAD=' + bad + ' MISMATCH=' + mismatch);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
