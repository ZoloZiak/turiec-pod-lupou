// READ-ONLY WATCH #133: reality-check 4 "pascových" korekcií proti RPO ŠÚ SR exact identifier.
// Kategória kde naivný strip medzier vedie na CUDZÍ subjekt -> mapa musí smerovať na REÁLNE IČO.
// Over: (a) cieľ-IČO v RPO existuje a názov sedí, (b) naivný-strip IČO je naozaj cudzí/iný subjekt.
const THROTTLE = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpo(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    const txt = await res.text();
    if (!res.ok) return { err: 'HTTP ' + res.status };
    const d = JSON.parse(txt);
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
    return { names: [...new Set(exact.flatMap(x => (x.fullNames || []).map(n => n.value)))] };
  } catch (e) { return { err: String(e.message).slice(0, 80) }; }
}
// [ malformed-string, expect-name, target-ico(mapa), naive-strip-ico ]
const cases = [
  ['52  222 438', 'BTI',       '47619503', '52222438'],
  ['54 228 573',  'Generali',  '35709332', '54228573'],
  ['50 513 923 ', 'EUROPOWER', '45541329', '50513923'],
  [' 47431563',   'RRA',       '52478424', '47431563'],
];
(async () => {
  for (const [raw, expect, target, strip] of cases) {
    const t = await rpo(target); await sleep(THROTTLE);
    const s = await rpo(strip);  await sleep(THROTTLE);
    console.log(`\n== "${raw}" (${expect}) ==`);
    console.log(`  MAPA-cieľ ${target}: ${t.err ? 'ERR ' + t.err : JSON.stringify(t.names)}`);
    console.log(`  naive-strip ${strip}: ${s.err ? 'ERR ' + s.err : JSON.stringify(s.names)}`);
  }
})();
