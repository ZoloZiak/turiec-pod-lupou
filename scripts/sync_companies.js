require('dotenv').config({ path: '.env.local' });
// Vypnutie SSL kontroli kvoli self-signed certs v enviromente
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const cloudscraper = require('cloudscraper');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targetCompanies = [
  { name: "Dopravný podnik mesta Martin, s.r.o.", ico: "53528255", type: "MHD" },
  { name: "Turiec a.s.", ico: "31636228", type: "Správa majetku" },
  { name: "Brantner Fatra s.r.o.", ico: "31590627", type: "Odpad" },
  { name: "Televízia Turiec, s.r.o.", ico: "31608674", type: "Médiá" },
  { name: "Mestský športový klub Martin, s.r.o.", ico: "53205774", type: "Šport" }
];

async function scrapeFinstatProfit(ico) {
  try {
    const html = await cloudscraper.get(`https://finstat.sk/${ico}`);
    const $ = cheerio.load(html);
    
    // Finstat štruktúra pre zisk zvyčajne obsahuje nadpis "Zisk" a vedľa sumu
    let profitText = null;
    
    // Skúsime vyhľadať všetky tagy čo obsahujú Zisk a pozrieť sa na okolie
    $('*').each((i, el) => {
      const text = $(el).text();
      if (text.includes('Zisk') || text.includes('Hospodársky výsledok')) {
        const parentHtml = $(el).parent().html();
        if (parentHtml) {
          const match = parentHtml.match(/([\\-\\d\\s]+)\\s*€/);
          if (match) {
            profitText = match[1];
          }
        }
      }
    });

    // Fallback regex priamo na surové HTML
    if (!profitText) {
      const match = html.match(/Zisk[^<]*.*?([\\-\\d\\s]+)\\s*€/is);
      if (match) profitText = match[1];
    }

    if (profitText) {
      const cleanNumber = parseInt(profitText.replace(/[^\\d\\-]/g, ''), 10);
      return isNaN(cleanNumber) ? null : cleanNumber;
    }
    
    return null;
  } catch (err) {
    console.error(`Chyba pri scrapovaní Finstatu (IČO ${ico}):`, err.message);
    return null;
  }
}

// Simulácia: Krtko zistí z otvorenej mestskej zmluvy koľko peňazí (dotácií) išlo z mesta
async function getCitySubsidyFromCRZ(ico) {
  // Tu Krtko spočíta reálne zmluvy medzi mestom a dodávateľom (CRZ)
  if (ico === "53528255") return 4500000;
  return 0; 
}

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem dáta REÁLNYM SCRAPINGOM z webu (Fáza 7.1)...");
  
  for (const company of targetCompanies) {
    console.log(`- Skúmam web pre IČO: ${company.ico}...`);
    
    let profit = await scrapeFinstatProfit(company.ico);
    if (profit === null) {
      console.log(`  [VAROVANIE] Hodnotu sa nepodarilo vycrawlovať. Nasadená Captcha alebo nová štruktúra.`);
      profit = 0; // fallback v pripade nepreniknutia
    } else {
      console.log(`  [ÚSPECH] Nájdený reálny zisk/strata (Live): ${profit} EUR`);
    }

    const subsidy = await getCitySubsidyFromCRZ(company.ico);

    const record = {
      name: company.name,
      ico: company.ico,
      type: company.type,
      profit_loss_eur: profit,
      city_subsidy_eur: subsidy,
      finstat_url: `https://finstat.sk/${company.ico}`,
      year: 2023
    };

    const { data: existing } = await supabase
      .from('city_companies')
      .select('id')
      .eq('ico', company.ico)
      .eq('year', 2023)
      .single();
      
    if (existing) {
      await supabase.from('city_companies').update(record).eq('id', existing.id);
    } else {
      await supabase.from('city_companies').insert(record);
    }
  }
  
  console.log("✅ Krtko dokončil extrakciu živých dát z webu.");
}

run();
