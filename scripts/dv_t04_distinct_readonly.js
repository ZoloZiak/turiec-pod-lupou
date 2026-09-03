// READ-ONLY: z .audit/T04_over100k_set.json spravi distinct ICO -> {name, max_amount, count, sample_url}
const fs = require('fs');
const set = JSON.parse(fs.readFileSync('.audit/T04_over100k_set.json', 'utf8'));
const map = new Map();
for (const r of set.items) {
  if (!r.ico || !/^\d{8}$/.test(String(r.ico))) continue;
  const k = String(r.ico);
  if (!map.has(k)) map.set(k, { ico: k, name: r.name, count: 0, max_amount: 0, sample_url: r.source_url });
  const e = map.get(k);
  e.count++;
  if (r.amount_eur > e.max_amount) { e.max_amount = r.amount_eur; e.sample_url = r.source_url; e.name = r.name; }
}
const list = [...map.values()].sort((a, b) => b.max_amount - a.max_amount);
fs.writeFileSync('.audit/T04_distinct_icos.json', JSON.stringify({ total: list.length, items: list }, null, 2));
for (const e of list) console.log(`${e.ico} | ${e.max_amount.toFixed(2)} | ${e.count}x | ${e.name}`);
