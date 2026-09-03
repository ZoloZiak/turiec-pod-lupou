// READ-ONLY: collect all distinct URLs from DB + UI code into .audit/DV-LINKS_set.json
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const urlCols = [
  ['transactions', 'source_url'],
  ['nku_reports', 'report_url'],
];

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const urls = new Set();
  const bySource = {};

  for (const [table, col] of urlCols) {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select(col).not(col, 'is', null).range(offset, offset + PAGE - 1);
      if (error) { console.error(table, error.message); break; }
      for (const r of data) {
        const u = (r[col] || '').trim();
        if (u && /^https?:\/\//i.test(u)) {
          if (!urls.has(u)) { urls.add(u); bySource[u] = `${table}.${col}`; }
        }
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  // UI code: scan src for http(s) URLs
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|ts|js|mjs)$/.test(e.name)) {
        const txt = fs.readFileSync(p, 'utf8');
        const re = /https?:\/\/[^\s"'`)\]>]+/g;
        let m;
        while ((m = re.exec(txt))) {
          const u = m[0].replace(/[.,;]+$/, '');
          if (!urls.has(u)) { urls.add(u); bySource[u] = 'code:' + path.relative(path.join(__dirname, '..'), p); }
        }
      }
    }
  }
  walk(path.join(__dirname, '..', 'src'));

  const list = [...urls].sort();
  const out = { collected: new Date().toISOString(), total: list.length, items: list.map(u => ({ url: u, src: bySource[u] })) };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'DV-LINKS_set.json'), JSON.stringify(out, null, 1));
  console.log('total distinct URLs:', list.length);
}
main().catch(e => { console.error(e); process.exit(1); });
