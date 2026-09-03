// READ-ONLY WATCH #89 dohľadanie: RPO overenie reálnych IČO + CRZ detail pre EUROPOWER/RRA.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rpo(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    const d = await res.json();
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
    if (!exact.length) return 'NO_EXACT';
    return [...new Set(exact.flatMap(x => (x.fullNames || []).map(n => n.value)))].join(' | ');
  } catch (e) { return 'ERR:' + e.message.slice(0, 40); }
}

async function crzDump(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    const rows = [...html.matchAll(/<strong[^>]*>([^<:]{2,40}):\s*<\/strong>\s*<span[^>]*>([^<]+)/gi)]
      .map(m => `${m[1].trim()} = ${m[2].trim()}`);
    return rows.filter(r => /IČO|Dodávateľ|Objednávateľ|Názov/i.test(r));
  } catch (e) { return ['ERR:' + e.message.slice(0, 60)]; }
}

(async () => {
  const icos = ['47619503', '50139088', '35709332', '00316873', '00316580', '00316679', '55049249', '31580726'];
  console.log('=== RPO overenie reálnych IČO ===');
  for (const i of icos) { console.log(`${i} = ${await rpo(i)}`); await sleep(300); }
  console.log('\n=== CRZ EUROPOWER (12252173) ===');
  for (const r of await crzDump('https://crz.gov.sk/zmluva/12252173/')) console.log('  ' + r);
  console.log('\n=== CRZ RRA (9000484) ===');
  for (const r of await crzDump('https://crz.gov.sk/zmluva/9000484/')) console.log('  ' + r);
})();
