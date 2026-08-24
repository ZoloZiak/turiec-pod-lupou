// READ-ONLY: RPO retry pre APIERR/ONE_SOURCE z dávky 120-159
const ICOS = ['36145319', '36211541', '36391000', '36414948', '36416291', '36432911', '36237337', '36407020', '36418137'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const ico of ICOS) {
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      console.log(ico, JSON.stringify(exact.map(x => (x.fullNames || []).map(n => n.value))));
    } catch (e) { console.log(ico + ' ERR ' + e.message); }
    await sleep(600);
  }
})();
