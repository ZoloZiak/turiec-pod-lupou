const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * REÁLNE hospodárske výsledky mestských podnikov mesta Martin.
 * Zdroj: RÚZ (registeruz.sk), individuálna účtovná závierka za rok 2025,
 *   Výkaz ziskov a strát — riadok "Výsledok hospodárenia po zdanení".
 * `ruz_vykaz` = ID účtovného výkazu, z ktorého číslo pochádza (auditovateľné cez API
 *   /cruz-public/api/uctovny-vykaz?id=<ruz_vykaz>).
 * Mestskú DOTÁCIU tu zámerne NEZAPISUJEME — tú počíta sync_companies.js reálne
 *   z CRZ zmlúv (getCitySubsidyFromCRZ). Žiadne hardcoded/odhadované sumy dotácií.
 */
const YEAR = 2025;

const COMPANY_RESULTS = [
  { ico: '53560922', profit_loss_eur: 1317.00,     type: 'Mestská hromadná doprava (MHD)',     ruz_vykaz: 10269671 },
  { ico: '37806939', profit_loss_eur: 53187.90,    type: 'Športoviská a zimný štadión',        ruz_vykaz: 10211121 },
  { ico: '42386497', profit_loss_eur: 4468.75,     type: 'Kultúra a amfiteáter',               ruz_vykaz: 10157354 },
  { ico: '53584244', profit_loss_eur: 33465.00,    type: 'Komunálne služby a zelená údržba',   ruz_vykaz: 10374042 },
  { ico: '42220360', profit_loss_eur: -12202.39,   type: 'Cestovný ruch a propagácia',         ruz_vykaz: 10011196 },
  { ico: '36387959', profit_loss_eur: 168945.00,   type: 'Parkovací systém mesta',             ruz_vykaz: 10298395 },
  { ico: '36672084', profit_loss_eur: 25774.00,    type: 'Vodárenstvo a kanalizácie (a.s.)',   ruz_vykaz: 10051098 },
];

async function updateResults() {
  console.log("🚀 Aktualizujem REÁLNE hospodárske výsledky (RÚZ 2025) pre mestské podniky Martin...");

  for (const item of COMPANY_RESULTS) {
    const { data: existing } = await supabase
      .from('city_companies')
      .select('id, name')
      .eq('ico', item.ico)
      .eq('year', YEAR)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('city_companies')
        .update({
          profit_loss_eur: item.profit_loss_eur,
          type: item.type,
          year: YEAR,
        })
        .eq('id', existing.id);
      console.log(`  [OK] ${existing.name}: VH ${YEAR} = ${item.profit_loss_eur.toLocaleString('sk-SK')} € (RÚZ výkaz ${item.ruz_vykaz})`);
    } else {
      console.warn(`  [PRESKOČENÉ] IČO ${item.ico} nie je v city_companies — spusti najprv sync_companies.`);
    }
  }

  console.log("🎉 Hotovo — hospodárske výsledky nastavené na reálne čísla z RÚZ.");
}

updateResults();
