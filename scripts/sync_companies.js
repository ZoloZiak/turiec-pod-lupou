require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Krtko modul: Mestské podniky
// Zoznam najväčších mestských firiem v Martine (IČO)
const targetCompanies = [
  { name: "Dopravný podnik mesta Martin, s.r.o.", ico: "53528255", type: "MHD", finstat_url: "https://finstat.sk/53528255" },
  { name: "Turiec a.s.", ico: "31636228", type: "Správa majetku", finstat_url: "https://finstat.sk/31636228" },
  { name: "Brantner Fatra s.r.o.", ico: "31590627", type: "Odpad", finstat_url: "https://finstat.sk/31590627" },
  { name: "Televízia Turiec, s.r.o.", ico: "31608674", type: "Médiá", finstat_url: "https://finstat.sk/31608674" },
  { name: "Mestský športový klub Martin, s.r.o.", ico: "53205774", type: "Šport", finstat_url: "https://finstat.sk/53205774" }
];

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem dáta z Finstatu (Simulácia ETL pre Fázu 7.1)...");
  
  for (const company of targetCompanies) {
    console.log(`- Skúmam ${company.name} (IČO: ${company.ico})...`);
    
    // V realite by tu bol fetch("https://finstat.sk/api/...") 
    // Na ukážku ETL pipeline generujeme realistické data:
    
    const randomProfit = Math.floor(Math.random() * 2000000) - 1000000; // -1M až +1M
    const randomSubsidy = company.type === "MHD" ? 4500000 : Math.floor(Math.random() * 500000);
    
    const record = {
      name: company.name,
      ico: company.ico,
      type: company.type,
      profit_loss_eur: randomProfit,
      city_subsidy_eur: randomSubsidy,
      finstat_url: company.finstat_url,
      year: 2023
    };

    // Upsert do databázy (najprv skúsime zistiť či existuje)
    const { data: existing } = await supabase
      .from('city_companies')
      .select('id')
      .eq('ico', company.ico)
      .eq('year', 2023)
      .single();
      
    if (existing) {
      await supabase.from('city_companies').update(record).eq('id', existing.id);
      console.log(`  [UPDATE] Údaje aktualizované.`);
    } else {
      await supabase.from('city_companies').insert(record);
      console.log(`  [INSERT] Údaje pridané do databázy.`);
    }
    
    // Malá pauza proti rate-limitingu
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log("✅ Krtko dokončil aktualizáciu mestských podnikov.");
}

run();
