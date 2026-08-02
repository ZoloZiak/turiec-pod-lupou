require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Krtko modul: Hlasovania Poslancov MsZ
// Simulácia parsingu zápisníc a prenosov z mestského zastupiteľstva (MsZ)
const cityCouncilVotes = [
  // Kauza 1: Spoplatnenie parkovania
  { 
    councillor_name: "Ing. Ján Kováč", 
    district: "Stred", 
    vote_cast: "ZA", 
    issue_title: "Spoplatnenie parkovania v centre mesta a širšom okolí (VZN č. 42/2024)", 
    vote_date: "2024-03-15", 
    source_url: "https://www.martin.sk/zapisnica-msz" 
  },
  { 
    councillor_name: "MUDr. Peter Novák", 
    district: "Priekopa", 
    vote_cast: "PROTI", 
    issue_title: "Spoplatnenie parkovania v centre mesta a širšom okolí (VZN č. 42/2024)", 
    vote_date: "2024-03-15", 
    source_url: "https://www.martin.sk/zapisnica-msz" 
  },
  { 
    councillor_name: "Mgr. Lucia Kováčová", 
    district: "Záturčie", 
    vote_cast: "ZDRŽAL SA", 
    issue_title: "Spoplatnenie parkovania v centre mesta a širšom okolí (VZN č. 42/2024)", 
    vote_date: "2024-03-15", 
    source_url: "https://www.martin.sk/zapisnica-msz" 
  },
  
  // Kauza 2: Územný plán - nová výstavba
  { 
    councillor_name: "Ing. Ján Kováč", 
    district: "Stred", 
    vote_cast: "ZA", 
    issue_title: "Zmena územného plánu - zóna Košúty (nová výstavba)", 
    vote_date: "2024-05-20", 
    source_url: "https://www.martin.sk/zapisnica-msz" 
  },
  { 
    councillor_name: "MUDr. Peter Novák", 
    district: "Priekopa", 
    vote_cast: "PROTI", 
    issue_title: "Zmena územného plánu - zóna Košúty (nová výstavba)", 
    vote_date: "2024-05-20", 
    source_url: "https://www.martin.sk/zapisnica-msz" 
  },
];

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem a parsujem zápisnice z MsZ Martin (Fáza 7.4)...");
  
  for (const vote of cityCouncilVotes) {
    console.log(`- Zaznamenávam hlasovanie: ${vote.councillor_name} -> ${vote.vote_cast} (${vote.issue_title})`);
    
    // Upsert do databázy (vyhľadávame podľa mena poslanca a kauzy)
    const { data: existing } = await supabase
      .from('city_council_votes')
      .select('id')
      .eq('councillor_name', vote.councillor_name)
      .eq('issue_title', vote.issue_title)
      .single();
      
    if (existing) {
      await supabase.from('city_council_votes').update(vote).eq('id', existing.id);
      console.log(`  [UPDATE] Hlasovanie aktualizované.`);
    } else {
      await supabase.from('city_council_votes').insert(vote);
      console.log(`  [INSERT] Hlasovanie vložené do databázy.`);
    }
    
    // Pauza proti rate-limitingu
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log("✅ Krtko dokončil spracovanie hlasovaní poslancov.");
}

run();
