require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Reálne správy a protokoly NKÚ SR vzťahujúce sa na Mesto Martin a projekty v Martine.
 * Žiadne generovanie náhodných dát ani fejkové sumy pokút.
 */
const VERIFIED_NKU_REPORTS = [
  {
    title: "Príprava a realizácia projektov nemocníc Rázsochy a Univerzitnej nemocnice Martin z Plánu obnovy",
    status: "Závažné zistenia / Ohrozenie termínov",
    description: "Oficiálna správa NKÚ SR k pripravenosti výstavby novej Univerzitnej nemocnice sv. Martina v Martine z Plánu obnovy a odolnosti. Kontrola konštatovala chýbajúce vecné podklady pri zaraďovaní do plánu obnovy a riziko nečerpania alokovaných eurofondov.",
    penalty_eur: 0,
    year: 2024,
    report_url: "https://www.nku.gov.sk/-/cerpanie-financii-z-planu-obnovy-pri-nemocniciach-razsochy-a-martin-bolo-od-zaciatku-ohrozene"
  }
];

async function run() {
  console.log("🕵️‍♂️ Krtko: Aktualizujem overené protokoly NKÚ SR pre Mesto Martin...");

  // Najprv vyčistíme staré halucinované záznamy
  const { error: delErr } = await supabase.from('nku_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.error("Chyba pri čistení tabuľky nku_reports:", delErr);

  for (const report of VERIFIED_NKU_REPORTS) {
    const { error: insErr } = await supabase.from('nku_reports').insert(report);
    if (insErr) {
      console.error(`Chyba pri vkladaní zprávy "${report.title}":`, insErr);
    } else {
      console.log(`  [ÚSPECH] Uložená ověřená správa NKÚ: ${report.title}`);
    }
  }

  console.log("✅ Krtko dokončil synchronizáciu 100% overených dát NKÚ SR.");
}

run();
