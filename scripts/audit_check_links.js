// READ-ONLY: HTTP-check a slice of .audit/DV-LINKS_set.json, report only non-200s
const fs = require('fs');
const path = require('path');
const setPath = path.join(__dirname, '..', '.audit', 'DV-LINKS_set.json');
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
const OFFSET = parseInt(process.argv[2] || '0', 10);
const LIMIT = parseInt(process.argv[3] || '60', 10);
const slice = set.items.slice(OFFSET, OFFSET + LIMIT);

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; audit-check/1.0)' },
    });
    clearTimeout(t);
    // consume body
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (e) {
    return 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80);
  }
}

(async () => {
  const bad = [];
  for (const it of slice) {
    const st = await check(it.url);
    if (st !== 200) bad.push({ ...it, status: st });
  }
  console.log(JSON.stringify({ offset: OFFSET, checked: slice.length, bad_count: bad.length, bad }, null, 1));
})();
