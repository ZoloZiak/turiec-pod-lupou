// READ-ONLY: RPO verifikácia opravných IČO
const ICOS = ['52713725', '36394947', '50769103'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const ico of ICOS) {
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      console.log(ico, JSON.stringify(exact.map(x => ({
        names: (x.fullNames || []).map(n => n.value),
        addr: (x.addresses || []).map(a => a.formatedAddress).slice(0, 1),
      })), null, 1));
    } catch (e) { console.log(ico + ' ERR ' + e.message); }
    await sleep(400);
  }
})();
