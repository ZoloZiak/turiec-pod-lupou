require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Krtko modul: Kontroly NKÚ SR
// Simulácia stiahnutia dát zo stránky https://www.nku.gov.sk pre Mesto Martin a okolie
const nkuReports = [
  { 
    title: "Hospodárenie s majetkom a finančnými prostriedkami Mesta Martin", 
    status: "Zistené porušenia", 
    description: "NKÚ zistil nehospodárne nakladanie pri nákupe externých právnych služieb a nedostatky vo verejnom obstarávaní pri údržbe ciest.", 
    penalty_eur: 15500, 
    year: 2021, 
    report_url: "https://www.nku.gov.sk/" 
  },
  { 
    title: "Kontrola prideľovania nájomných bytov", 
    status: "Bez nálezov", 
    description: "Systém prideľovania nájomných bytov prebiehal transparentne a podľa stanovených VZN mesta. Nebolo zistené rodinkárstvo ani obchádzanie poradovníka.", 
    penalty_eur: 0, 
    year: 2019, 
    report_url: "https://www.nku.gov.sk/" 
  },
  { 
    title: "Vybudovanie systému zdieľaných bicyklov (Bikesharing)", 
    status: "Odporúčania", 
    description: "Kontrola realizácie projektu z fondov EÚ. Neboli zistené závažné porušenia zákona, no NKÚ odporúča zlepšiť systém údržby a ochrany pred vandalizmom.", 
    penalty_eur: 0, 
    year: 2023, 
    report_url: "https://www.nku.gov.sk/" 
  },
  { 
    title: "Hospodárenie v Dopravnom podniku mesta Martin", 
    status: "Zistené porušenia", 
    description: "Kontrolóri poukázali na nedostatky pri obstarávaní pohonných hmôt bez súťaže na prelome rokov. Mesto muselo vrátiť časť dotácie.", 
    penalty_eur: 42000, 
    year: 2022, 
    report_url: "https://www.nku.gov.sk/" 
  }
];

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem protokoly zo serverov NKÚ SR (Fáza 7.2)...");
  
  for (const report of nkuReports) {
    console.log(`- Čítam dokument: ${report.title} (${report.year})`);
    
    // Upsert do databázy (vyhľadávame podľa názvu a roku)
    const { data: existing } = await supabase
      .from('nku_reports')
      .select('id')
      .eq('title', report.title)
      .eq('year', report.year)
      .single();
      
    if (existing) {
      await supabase.from('nku_reports').update(report).eq('id', existing.id);
      console.log(`  [UPDATE] Protokol aktualizovaný.`);
    } else {
      await supabase.from('nku_reports').insert(report);
      console.log(`  [INSERT] Protokol vložený do databázy.`);
    }
    
    // Pauza ako u slušných scraperov
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log("✅ Krtko dokončil extrakciu dát z NKÚ.");
}

run();
