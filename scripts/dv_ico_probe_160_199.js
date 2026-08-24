// READ-ONLY deep probe for suspicious ICOs from batch 160-199
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jget(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  const txt = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return JSON.parse(txt);
}
async function rpo(q) {
  try {
    const d = await jget(`https://api.statistics.sk/rpo/v1/search?fullName=${encodeURIComponent(q)}`);
    return (d.results || []).map(x => ({
      ico: [...new Set((x.identifiers || []).map(i => i.value))],
      names: (x.fullNames || []).map(n => n.value),
      types: x.forms ? undefined : undefined,
    }));
  } catch (e) { return ['ERR ' + e.message]; }
}
(async () => {
  const out = {};
  // 1) Adfex - find real ICO by name
  out.adfex_byName = await rpo('Adfex');
  // 2) Blue Butterfly
  out.blueButterfly_byName = await rpo('Blue Butterfly');
  out.bartakova = await rpo('Bartáková');
  // 3) Puskar kamenarstvo
  out.puskar = await rpo('Puškár kamenárstvo');
  out.laurova = await rpo('Laurová');
  // 4) Sprava sportovych zariadeni Martin
  out.ssz = await rpo('Správa športových zariadení Martin');
  console.log(JSON.stringify(out, null, 2));
})();
