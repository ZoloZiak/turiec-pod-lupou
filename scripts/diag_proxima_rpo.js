// READ-ONLY: najdi PROXIMA, a.s. v RPO fullName search results
const j = JSON.parse(require('fs').readFileSync('/tmp/rpo_proxima2.json', 'utf8'))
for (const r of j.results || []) {
  const names = (r.fullNames || []).map(f => f.value)
  const last = names[names.length - 1]
  if (/^PROXIMA,\s*a\.?\s?s\.?$/i.test(last) || /^PROXIMA a\.?\s?s\.?$/i.test(last)) {
    console.log(JSON.stringify({ id: r.id, ico: r.identifiers[0].value, names, addr: (r.addresses || [])[0], termination: r.termination }))
  }
}
