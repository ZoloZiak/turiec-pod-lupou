require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Krtko modul: Eurofondy a Dotácie (ITMS2014+ / Plán obnovy)
// Simulácia stiahnutia dát zo štátnych dotačných systémov pre mesto Martin
const euFunds = [
  { 
    project_name: "Zníženie energetickej náročnosti budovy ZŠ Hurbanova", 
    amount_eur: 845000, 
    program_name: "IROP (Integrovaný regionálny operačný program)", 
    year: 2022, 
    winner_ico: "36413186", 
    winner_name: "Stavebná firma Turiec s.r.o." 
  },
  { 
    project_name: "Budovanie cyklotrás v regióne Turiec", 
    amount_eur: 1200000, 
    program_name: "Plán obnovy a odolnosti SR", 
    year: 2023, 
    winner_ico: "31562933", 
    winner_name: "Doprastav, a.s." 
  },
  { 
    project_name: "Zvýšenie kapacít MŠ v mestskej časti Priekopa", 
    amount_eur: 450000, 
    program_name: "Operačný program Ľudské zdroje", 
    year: 2021, 
    winner_ico: "45612399", 
    winner_name: "Stavomartin s.r.o." 
  },
  { 
    project_name: "Modernizácia prístrojového vybavenia Univerzitnej nemocnice", 
    amount_eur: 3500000, 
    program_name: "IROP (Integrovaný regionálny operačný program)", 
    year: 2022, 
    winner_ico: null, 
    winner_name: "Neznámy dodávateľ (Čaká na CRZ)" 
  }
];

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem dáta z ITMS a Plánu obnovy (Fáza 7.3)...");
  
  for (const fund of euFunds) {
    console.log(`- Načítavam projekt: ${fund.project_name} (${fund.amount_eur} EUR)`);
    
    // Upsert do databázy (vyhľadávame podľa názvu)
    const { data: existing } = await supabase
      .from('eu_funds')
      .select('id')
      .eq('project_name', fund.project_name)
      .eq('year', fund.year)
      .single();
      
    if (existing) {
      await supabase.from('eu_funds').update(fund).eq('id', existing.id);
      console.log(`  [UPDATE] Projekt aktualizovaný.`);
    } else {
      await supabase.from('eu_funds').insert(fund);
      console.log(`  [INSERT] Projekt vložený do databázy.`);
    }
    
    // Pauza proti rate-limitingu
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log("✅ Krtko dokončil extrakciu dát o eurofondoch.");
}

run();
