require('dotenv').config({ path: '.env.local' });
// Vypnutie SSL kontroli kvoli self-signed certs v enviromente
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const cloudscraper = require('cloudscraper');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targetCompanies = [
  { name: 'Martinská parkovacia spoločnosť, a.s.', ico: '36387959', type: 'Parkovanie' },
  { name: 'Dopravný podnik mesta Martin, s.r.o.', ico: '53560922', type: 'MHD' },
  { name: 'Oblastná organizácia cestovného ruchu Turiec', ico: '42220360', type: 'Cestovný ruch' },
  { name: 'Turčianska vodárenská spoločnosť, a.s.', ico: '36402691', type: 'Vodárne' },
  { name: 'Sociálny podnik mesta Martin, s. r. o.', ico: '52402126', type: 'Služby' },
  { name: 'Správa športových zariadení mesta Martin', ico: '37905185', type: 'Šport' },
  { name: 'Kultúrna scéna Martin', ico: '53560795', type: 'Kultúra' }
];

async function scrapeFinstatProfit(ico) {
  try {
    const html = await cloudscraper.get(`https://finstat.sk/${ico}`);
    const $ = cheerio.load(html);
    
    // FinStat schováva skutočné dáta za AJAX/Knockout.js, no do <meta name="description">
    // ich kvôli Googlu vkladá server-side.
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const match = metaDesc.match(/Zisk:\s*([\d\s\u00A0]+) €/i) || metaDesc.match(/Hospodársky výsledok:\s*([\d\s\u00A0]+) €/i);
    
    if (match) {
      const cleanNumber = parseInt(match[1].replace(/[\s\u00A0]/g, ''), 10);
      return isNaN(cleanNumber) ? null : cleanNumber;
    }
    
    return null;
  } catch (err) {
    console.error(`Chyba pri scrapovaní Finstatu (IČO ${ico}):`, err.message);
    return null;
  }
}

// Vypočíta reálne sumy zmlúv (dotácií) pre daný podnik z našej CRZ databázy
async function getCitySubsidyFromCRZ(ico) {
  // Najprv nájdeme interné ID entity podľa IČO
  const { data: entity } = await supabase.from('entities').select('id').eq('ico', ico).single();
  if (!entity) return 0;
  
  // Následne sčítame hodnotu všetkých zmlúv, kde daný podnik figuruje ako dodávateľ (prijímateľ peňazí od mesta)
  const { data: transactions } = await supabase.from('transactions')
    .select('amount_eur')
    .eq('supplier_entity_id', entity.id);
    
  if (!transactions || transactions.length === 0) return 0;
  return transactions.reduce((acc, row) => acc + (row.amount_eur || 0), 0);
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
