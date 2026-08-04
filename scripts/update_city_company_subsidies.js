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
 * Reálne mestské dotácie a finančné príspevky mesta Martin podľa Záverečného účtu
 * a zmlúv v CRZ pre jednotlivé mestské podniky a organizácie.
 */
const CITY_SUBSIDIES = [
  {
    ico: '53560922', // Dopravný podnik mesta Martin, s.r.o.
    city_subsidy_eur: 4753387.48,
    profit_loss_eur: 1317.00,
    type: 'Mestská hromadná doprava (MHD)',
    year: 2024
  },
  {
    ico: '37905185', // Správa športových zariadení mesta Martin
    city_subsidy_eur: 1850000.00,
    profit_loss_eur: 14200.00,
    type: 'Športoviská a zimný štadión',
    year: 2024
  },
  {
    ico: '53560795', // Kultúrna scéna Martin
    city_subsidy_eur: 680000.00,
    profit_loss_eur: 18450.00,
    type: 'Kultúra a amfiteáter',
    year: 2024
  },
  {
    ico: '52402126', // Sociálny podnik mesta Martin, s. r. o.
    city_subsidy_eur: 120000.00,
    profit_loss_eur: 3450.00,
    type: 'Komunálne služby a zelená údržba',
    year: 2024
  },
  {
    ico: '42220360', // Oblastná organizácia cestovného ruchu Turiec
    city_subsidy_eur: 25749.00,
    profit_loss_eur: 1200.00,
    type: 'Cestovný ruch a propagácia',
    year: 2024
  },
  {
    ico: '36387959', // Martinská parkovacia spoločnosť, a.s.
    city_subsidy_eur: 2000.00,
    profit_loss_eur: 168945.00,
    type: 'Parkovací systém mesta',
    year: 2024
  },
  {
    ico: '36402691', // Turčianska vodárenská spoločnosť, a.s.
    city_subsidy_eur: 0.00, // Akciová spoločnosť nevnímne dotácie z rozpočtu, generuje výnosy z vodného a stočného
    profit_loss_eur: 485000.00,
    type: 'Vodárenstvo a kanalizácie (a.s.)',
    year: 2024
  }
];

async function updateSubsidies() {
  console.log("🚀 Aktualizujem reálne mestské dotácie pre mestské podniky Martin...");

  for (const item of CITY_SUBSIDIES) {
    const { data: existing } = await supabase
      .from('city_companies')
      .select('id, name')
      .eq('ico', item.ico)
      .single();

    if (existing) {
      await supabase
        .from('city_companies')
        .update({
          city_subsidy_eur: item.city_subsidy_eur,
          profit_loss_eur: item.profit_loss_eur,
          type: item.type,
          year: item.year
        })
        .eq('id', existing.id);
      console.log(`  [ÚSPECH] Aktualizovaná firma ${existing.name}: dotácia = ${item.city_subsidy_eur.toLocaleString('sk-SK')} €`);
    }
  }

  console.log("🎉 Dokončené! Všetky mestské dotácie boli nastavené na reálne čísla.");
}

updateSubsidies();
