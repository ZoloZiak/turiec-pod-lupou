const fs = require('fs')
for (const f of ['/tmp/rpo_36384224.json', '/tmp/rpo_37811801.json']) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'))
  for (const r of j.results || []) {
    console.log(f, '=>', r.identifiers[0].value, '|', (r.fullNames || []).map(x => x.value).join(' / '), '|', (r.addresses || [])[0] && (r.addresses[0].municipality || {}).value)
  }
}
