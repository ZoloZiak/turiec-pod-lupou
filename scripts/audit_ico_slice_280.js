const s = require('/Users/ziak.z/projects/turiec-pod-lupou/.audit/DV-ICO-ALL_set.json')
let a = s
if (!Array.isArray(s)) a = s.items || s.list || s.entries || s.icos || []
console.log('len', a.length)
for (const x of a.slice(280, 315)) {
  console.log(JSON.stringify(x))
}
