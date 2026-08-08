require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ⚠️ POZOR — TENTO SKRIPT JE ZÁMERNE NO-OP (nič nezapisuje do DB).
//
// Pôvodná verzia tohto skriptu FABRIKOVALA dáta:
//   - amount_eur = Math.floor(Math.random() * 1000000)  -> NÁHODNÉ sumy
//   - winner_ico = "31562933" (hardcoded, v RPO ŠÚ SR NEEXISTUJE)
//   - winner_name = "Vyextrahované z: <url>" (debug string, nie meno)
//   - program_name = "Plán obnovy (Live Crawl)" (predstieral live zdroj)
// Tie dáta boli odstránené z DB (scripts/clear_eu_funds.js).
//
// Na transparentnostnom webe je fabrikát neprípustný. Kým NEBUDE
// implementovaný SPOĽAHLIVÝ REÁLNY parser skutočného zdroja eurofondov
// pre Martin (ITMS2014+ / Plán obnovy — s overiteľnými IČO a sumami),
// tento skript zámerne NEVKLADÁ nič do databázy.
//
// TODO (doimplementovať pred aktiváciou):
//   1. Napojiť reálny zdroj (ITMS2014+ open data / planobnovy.sk realizacia).
//   2. Parsovať skutočné: project_name, amount_eur, winner_ico, winner_name, program_name, year.
//   3. Validovať IČO voči RPO ŠÚ SR (žiadne hardcoded/neexistujúce).
//   4. Až potom povoliť insert/update do eu_funds.

async function run() {
  console.log('🛑 sync_eurofondy: NO-OP (žiadny zápis do DB).');
  console.log('   Dôvod: reálny ITMS/planobnovy parser pre Martin ešte NIE JE implementovaný.');
  console.log('   Predchádzajúca verzia generovala náhodné (fabrikované) čísla — bola odstránená.');
  console.log('   Pokým nebude napojený overiteľný reálny zdroj, modul Eurofondy zostáva prázdny.');
  console.log('   NEVKLADAJÚ sa žiadne dáta. Viď TODO v tomto súbore.');
  // Zámerne žiadny insert/update. `supabase` je inicializovaný len pre budúcu
  // reálnu implementáciu — teraz sa nepoužíva na zápis.
  void supabase;
}

run();
