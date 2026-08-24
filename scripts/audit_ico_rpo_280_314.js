// DV-ICO-ALL batch 280-314: verify each ICO against RPO (api.statistics.sk) — READ-ONLY
const fs = require('fs')
const setPath = '/Users/ziak.z/projects/turiec-pod-lupou/.audit/DV-ICO-ALL_set.json'
const outPath = '/Users/ziak.z/projects/turiec-pod-lupou/.audit/DV-ICO-ALL_rpo_280_314.json'
const s = JSON.parse(fs.readFileSync(setPath, 'utf8'))
const all = Array.isArray(s) ? s : (s.items || s.list || s.entries || [])
const batch = all.slice(280, 315)

function norm(x) {
  return (x || '').toUpperCase().replace(/[^A-Z0-9ÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ]/g, '')
}
function coreName(x) {
  // strip legal forms for comparison
  return (x || '').toUpperCase()
    .replace(/\b(S\.?\s?R\.?O\.?|A\.?\s?S\.?|V\.?\s?O\.?\s?S\.?|S\.?\s?R\.?L\.?)\b/g, ' ')
    .replace(/[^A-Z0-9ÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]/g, '').replace(/\s+/g, ' ').trim()
}

async function rpo(ico) {
  const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}&pageSize=20`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return { error: 'HTTP ' + res.status }
  const j = await res.json()
  const hits = []
  for (const o of j.results || []) {
    const ids = (o.identifiers || []).map(i => i.value)
    if (!ids.includes(ico)) continue
    hits.push({
      name: (o.fullNames && o.fullNames.length ? o.fullNames[o.fullNames.length - 1].value : null),
      allNames: (o.fullNames || []).map(f => f.value),
      address: (o.addresses || []).map(a => [a.street, a.buildingNumber, a.municipality && a.municipality.value].filter(Boolean).join(' ')).join(' | '),
      register: o.sourceRegister && o.sourceRegister.value ? o.sourceRegister.value.value : null,
    })
  }
  return { hits }
}

;(async () => {
  const out = []
  for (const e of batch) {
    let r
    try { r = await rpo(e.ico) } catch (err) { r = { error: String(err) } }
    const rec = { ...e }
    if (r.hits && r.hits.length) {
      const h = r.hits[0]
      rec.match_exact = true
      rec.name_match = coreName(h.name) === coreName(e.name) ? 'exact' : 'diff'
      rec.core_match = coreName(h.name).replace(/ /g, '') === coreName(e.name).replace(/ /g, '') ? 'exact' : rec.name_match
      rec.rpo_name = h.name
      rec.rpo_all_names = h.allNames
      rec.rpo_address = h.address
      rec.rpo_register = h.register
    } else if (r.hits) {
      rec.match_exact = false
    } else {
      rec.error = r.error
    }
    out.push(rec)
    console.log(e.ico, '|', e.name, '=>', rec.match_exact ? (rec.core_match === 'exact' ? 'OK' : 'DIFF: ' + rec.rpo_name + ' @ ' + rec.rpo_address) : ('NO-RPO ' + (rec.error || '')))
    await new Promise(r2 => setTimeout(r2, 700))
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1))
})()
