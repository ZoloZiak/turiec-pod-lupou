// READ-ONLY: RPO deep probe pre sporné IČO z dávky 120-159
const ICOS = ['36399124', '36399728', '36437141', '36403008'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const ico of ICOS) {
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      console.log(JSON.stringify({
        ico,
        n: exact.length,
        entries: exact.map(x => ({
          names: (x.fullNames || []).map(n => `${n.value} [${n.validFrom || '?'}..${n.validTo || '*'}]`),
          addr: (x.addresses || []).map(a => a.formatedAddress).slice(0, 1),
        })),
      }, null, 1));
    } catch (e) { console.log(ico + ' ERR ' + e.message); }
    await sleep(400);
  }
})();
