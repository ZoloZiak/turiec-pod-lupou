const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Zneutralizovanie statusov v tabuľke promises (Sľubomer).
 * Statusy SPLNENÉ/ZABUDNUTÉ/V RIEŠENÍ boli REDAKČNÉ hodnotenia menovaného politika
 * (Ján Danko) BEZ doloženého dôkazu — source_url len homepage, related_transaction_ids=[].
 * Neoverené hodnotenie ("ZABUDNUTÉ" / "SPLNENÉ") menovanej osoby je na transparentnostnom
 * Kým sa každý sľub nedoloží konkrétnym dokumentom, nehodnotíme splnenie.
 * DB enum promise_status povoľuje len SPLNENÉ/V RIEŠENÍ/ZABUDNUTÉ — nová hodnota
 * "NEOVERENÉ" sa cez klienta pridať nedá (chce ALTER TYPE). Preto všetky sľuby
 * nastavíme na najneutrálnejší existujúci status "V RIEŠENÍ" (nekonštatuje ani úspech,
 * ani zlyhanie menovanej osoby); disclaimer v UI to vysvetľuje. Dry-run default, --apply vykoná.
 */
const APPLY = process.argv.includes('--apply');
const NEUTRAL = 'V RIEŠENÍ';

(async () => {
  const { data, error } = await supabase.from('promises').select('id, title, status');
  if (error) { console.error('DB:', error.message); process.exit(1); }
  const toChange = data.filter(p => p.status !== NEUTRAL);
  console.log(APPLY ? '🔧 APPLY' : '👀 DRY-RUN', `— ${toChange.length}/${data.length} sľubov na neutrálny status "${NEUTRAL}":`);
  toChange.forEach(p => console.log(`  [${p.status}] → ${NEUTRAL} | ${p.title}`));
  if (!APPLY) { console.log('\nSpusti s --apply.'); return; }
  for (const p of toChange) {
    const { error: e } = await supabase.from('promises').update({ status: NEUTRAL }).eq('id', p.id);
    if (e) console.error(`  chyba ${p.title}:`, e.message);
  }
  console.log('✅ Statusy zneutralizované na "' + NEUTRAL + '".');
})();
