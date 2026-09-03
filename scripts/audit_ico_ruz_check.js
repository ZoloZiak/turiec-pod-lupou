// Ruz cross-check pre problematicne ICO + dohladanie spravnych subjektov
const LIST = [
  { ico: '47493540', note: 'STAVAJ-SK NOT_FOUND v RPO' },
  { ico: '45516286', note: 'AUTOKLUB pravna forma' },
  { ico: '44802030', note: 'TuCon vs Marti' },
];

async function ruz(ico) {
  const url = `https://registeruz.sk/cr/public/api/uctovne-jednotky?ico=${ico}&max=10&p=1`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return { http: r.status };
  const j = await r.json();
  return { http: r.status, count: Array.isArray(j) ? j.length : null, items: Array.isArray(j) ? j.map(x => ({ id: x.id, ico: x.ico, name: x.nazov })) : j };
}

async function rpoSearch(q) {
  const url = `https://api.statistics.sk/rpo/v1/search?searchText=${encodeURIComponent(q)}&pageSize=8`;
  const r = await fetch(url);
  if (!r.ok) return { http: r.status };
  const j = await r.json();
  const out = [];
  for (const res of j.results || []) {
    const names = (res.fullNames || []).map(f => f.value);
    const ids = (res.identifiers || []).map(i => i.value);
    const ad = res.addresses && res.addresses[0];
    out.push({ names, ids, city: ad ? `${ad.municipality || ''}` : null });
  }
  return out;
}

(async () => {
  const verdicts = {};
  for (const item of LIST) {
    verdicts[item.ico] = { note: item.note, ruz: await ruz(item.ico) };
    await new Promise(r => setTimeout(r, 400));
  }
  // dohladanie spravnych subjektov podla nazvu
  verdicts['_search_TuCon'] = await rpoSearch('TuCon');
  await new Promise(r => setTimeout(r, 400));
  verdicts['_search_AUTOKLUB'] = await rpoSearch('AUTOKLUB');
  console.log(JSON.stringify(verdicts, null, 1));
})();
