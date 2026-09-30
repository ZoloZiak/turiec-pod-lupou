require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Reálne, overené záznamy z nezávislých kontrol mesta Martin a jeho podnikov.
 * DVE inštitúcie (nezamieňať!):
 *   - NKÚ SR = Najvyšší kontrolný úrad Slovenskej republiky (celoštátny)
 *   - ÚHK   = Útvar hlavného kontrolóra mesta Martin (mestský kontrolór, § 18f z. 369/1990)
 * Každý záznam nesie inštitúciu v popise. Žiadne vymyslené sumy pokút ani zistenia.
 * Popis uvádza LEN overiteľné fakty (predmet kontroly, číslo správy, dátum, uznesenie MsZ);
 * uvedenie kontroly NIE JE tvrdenie o preukázanom pochybení.
 * Zdroje: nku.gov.sk a martin.sk (prehľad správ hlavného kontrolóra + Správa o kontrolnej
 * činnosti hl. kontrolóra za rok 2023, prerok. MsZ 29. 2. 2024).
 */
const VERIFIED_NKU_REPORTS = [
  {
    title: "Univerzitná nemocnica Martin — čerpanie financií z Plánu obnovy",
    status: "NKÚ SR · závažné zistenia",
    description: "Kontrola NKÚ SR (Najvyšší kontrolný úrad SR): pripravenosť výstavby novej Univerzitnej nemocnice sv. Martina financovanej z Plánu obnovy a odolnosti. NKÚ upozornil na chýbajúce vecné podklady pri zaraďovaní projektu do plánu obnovy a na riziko nečerpania alokovaných prostriedkov.",
    penalty_eur: 0,
    year: 2024,
    report_url: "https://www.nku.gov.sk/-/cerpanie-financii-z-planu-obnovy-pri-nemocniciach-razsochy-a-martin-bolo-od-zaciatku-ohrozene"
  },
  {
    title: "Brantner Fatra, s.r.o. — kontrola úhrad a výdavkov (odpadové hospodárstvo)",
    status: "Hlavný kontrolór mesta · kontrola vykonaná",
    description: "Kontrola hlavného kontrolóra mesta Martin (ÚHK): úhrady a výdavky v IV. štvrťroku 2022 fakturované spoločnosťou Brantner Fatra, s.r.o. Správa č. 8/I-23 predložená mestskému zastupiteľstvu 17. 8. 2023, zobratá na vedomie uznesením č. 170/23. Plné znenie v prehľade správ hlavného kontrolóra na martin.sk.",
    penalty_eur: 0,
    year: 2023,
    report_url: "https://www.martin.sk/informativne-spravy-o-vysledkoch-kontrol/ds-2456"
  },
  {
    title: "Polyfunkčný objekt „Leopolis“ — postup Útvaru hlavného architekta",
    status: "Hlavný kontrolór mesta · kontrola vykonaná",
    description: "Kontrola hlavného kontrolóra mesta Martin (ÚHK): postup rozpočtovej organizácie Útvaru hlavného architekta mesta vo veci stavby „Polyfunkčný objekt Leopolis“ z hľadiska dodržiavania všeobecne záväzných právnych predpisov. Správa č. MK 11/II-23 predložená MsZ 17. 8. 2023, zobratá na vedomie uznesením č. 170/23.",
    penalty_eur: 0,
    year: 2023,
    report_url: "https://www.martin.sk/informativne-spravy-o-vysledkoch-kontrol/ds-2456"
  },
  {
    title: "Dopravný podnik mesta Martin, s.r.o. — hospodárenie za rok 2022",
    status: "Hlavný kontrolór mesta · kontrola vykonaná",
    description: "Kontrola hlavného kontrolóra mesta Martin (ÚHK): hospodárenie mestskej spoločnosti Dopravný podnik mesta Martin, s.r.o. za rok 2022. Správa č. 6/I-23 predložená MsZ 26. 10. 2023, zobratá na vedomie uznesením č. 215/23.",
    penalty_eur: 0,
    year: 2023,
    report_url: "https://www.martin.sk/informativne-spravy-o-vysledkoch-kontrol/ds-2456"
  },
  {
    title: "Sociálny podnik mesta Martin, s.r.o. — hospodárenie za rok 2022",
    status: "Hlavný kontrolór mesta · kontrola vykonaná",
    description: "Kontrola hlavného kontrolóra mesta Martin (ÚHK): hospodárenie mestskej spoločnosti Sociálny podnik mesta Martin, s.r.o., r.s.p. za rok 2022. Správa č. 5/II-23 predložená MsZ 30. 11. 2023, zobratá na vedomie uznesením č. 253/23.",
    penalty_eur: 0,
    year: 2023,
    report_url: "https://www.martin.sk/informativne-spravy-o-vysledkoch-kontrol/ds-2456"
  }
];

async function run() {
  console.log("Aktualizujem overené kontroly (NKÚ SR + hlavný kontrolór mesta) pre Mesto Martin...");

  const { error: delErr } = await supabase.from('nku_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.error("Chyba pri čistení tabuľky nku_reports:", delErr);

  for (const report of VERIFIED_NKU_REPORTS) {
    const { error: insErr } = await supabase.from('nku_reports').insert(report);
    if (insErr) {
      console.error(`Chyba pri vkladaní správy "${report.title}":`, insErr);
    } else {
      console.log(`  [OK] ${report.title}`);
    }
  }

  const { count } = await supabase.from('nku_reports').select('*', { count: 'exact', head: true });
  console.log(`Hotovo. V tabuľke nku_reports je teraz ${count} overených záznamov.`);
}

run();
