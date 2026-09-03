const UA = { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } };
async function g(u) { try { const r = await fetch(u, UA); const t = await r.text(); return { status: r.status, head: t.slice(0, 400) }; } catch (e) { return { err: String(e).slice(0, 80) }; } }
(async () => {
  const res = {};
  res.nazov = await g('https://api.statistics.sk/rpo/v1/search?nazov=TUCON&pageSize=5');
  await new Promise(r => setTimeout(r, 300));
  res.businessName = await g('https://api.statistics.sk/rpo/v1/search?businessName=AUTOKLUB&pageSize=5');
  console.log(JSON.stringify(res, null, 1));
})();
