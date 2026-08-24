const j = JSON.parse(require('fs').readFileSync('/Users/ziak.z/projects/turiec-pod-lupou/.audit/progress.json', 'utf8'))
const t = j.queue.find(q => q.id === 'DV-ICO-ALL')
console.log('valid JSON; DV-ICO-ALL:', t.status, t.cursor, '/', t.total)
