// T10 fix: 3 promises maju source_url 'https://martin.sk/volebny-program' -> HTTP 404
// (mrtvy link na transparentnom webe). Realny stabilny volebny-program URL na martin.sk
// neexistuje (overene: /volebny-program 301->404, /volebny-program-2022 404).
// Zjednocujeme na oficialnu homepage mesta 'https://www.martin.sk/' (HTTP 200),
// konzistentne s ostatnymi slubmi. Iba OPRAVA mrtveho linku, ziadne nove obvinenie
// menovanej osoby (poistka dodrzana). Idempotentne. dry-run default, --apply na zapis.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const DEAD = 'https://martin.sk/volebny-program';
const FIXED = 'https://www.martin.sk/';
const APPLY = process.argv.includes('--apply');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('promises')
    .select('id, title, source_url')
    .eq('source_url', DEAD);
  if (error) { console.log('SELECT ERR ' + error.message); process.exit(1); }
  console.log('Najdenych s mrtvym source_url (' + DEAD + '): ' + (data ? data.length : 0));
  for (const r of (data || [])) console.log('  - ' + r.id + '  ' + r.title);
  if (!data || data.length === 0) { console.log('Nic na opravu (uz opravene?) -> idempotentne OK.'); return; }
  if (!APPLY) { console.log('DRY-RUN: spusti s --apply na zapis (' + DEAD + ' -> ' + FIXED + ').'); return; }
  const { data: upd, error: e2 } = await supabase
    .from('promises')
    .update({ source_url: FIXED })
    .eq('source_url', DEAD)
    .select('id');
  if (e2) { console.log('UPDATE ERR ' + e2.message); process.exit(1); }
  console.log('APPLIED: aktualizovanych ' + (upd ? upd.length : 0) + ' riadkov na ' + FIXED);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
