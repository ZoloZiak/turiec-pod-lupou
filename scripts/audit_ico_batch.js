const s = require('/Users/ziak.z/projects/turiec-pod-lupou/.audit/DV-ICO-ALL_set.json');
console.log(Array.isArray(s), Object.keys(s).slice(0, 10));
const arr = Array.isArray(s) ? s : (s.items || s.icos || Object.values(s)[0]);
console.log(JSON.stringify(arr.slice(200, 240), null, 1));
