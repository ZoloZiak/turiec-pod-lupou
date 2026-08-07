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
  { name: 'Turčianska vodárenská spoločnosť, a.s.', ico: '36672084', type: 'Vodárne' },
  { name: 'Sociálny podnik mesta Martin, s. r. o.', ico: '53584244', type: 'Služby' },
  { name: 'Správa športových zariadení mesta Martin', ico: '37806939', type: 'Šport' },
  { name: 'Kultúrna scéna Martin', ico: '42386497', type: 'Kultúra' }
];

async function scrapeFinstatProfit(ico) {
  try {
    const html = await cloudscraper.get(`https://finstat.sk/${ico}`);
    const $ = cheerio.load(html);
    
    // FinStat schováva skutočné dáta za AJAX/Knockout.js, no do <meta name="description">
    // ich kvôli Googlu vkladá server-side.
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const match = metaDesc.match(/Zisk:\s*([\d\s\u00A0]+) €/i) || metaDesc.match(/Hospodársky výsledok:\s*([\d\s\u00A0]+) €/i);
    
    // Zistime rok z textu stranky
    const text = $('body').text().replace(/\s+/g, ' ');
    const rokMatch = text.match(/v roku (20\d\d)/i);
    const rok = rokMatch ? parseInt(rokMatch[1], 10) : new Date().getFullYear() - 1; // Default to last year if not found
    
    if (match) {
      const cleanNumber = parseInt(match[1].replace(/[\s\u00A0]/g, ''), 10);
      return { profit: isNaN(cleanNumber) ? null : cleanNumber, year: rok };
    }
    
    return { profit: null, year: rok };
  } catch (err) {
    console.error(`Chyba pri scrapovaní Finstatu (IČO ${ico}):`, err.message);
    return { profit: null, year: 2025 };
  }
}

// Vypočíta reálne sumy zmlúv (dotácií) pre daný podnik z našej CRZ databázy PRE DANÝ ROK
async function getCitySubsidyFromCRZ(ico, year) {
  // Najprv nájdeme interné ID mesta Martin (aby sme rátali len dotácie od mesta)
  const { data: mesto } = await supabase.from('entities').select('id').eq('ico', '00316792').single();
  if (!mesto) return 0;
  
  // Získame názov cieľovej firmy pre textové porovnanie
  const { data: company } = await supabase.from('entities').select('name').eq('ico', ico).single();
  if (!company) return 0;
  
  // Následne sčítame hodnotu všetkých zmlúv od mesta z daného roka
  const { data: transactions } = await supabase.from('transactions')
    .select('amount_eur, supplier:supplier_entity_id(name)')
    .eq('buyer_entity_id', mesto.id)
    .gte('date_published', `${year}-01-01`)
    .lte('date_published', `${year}-12-31`);
    
  if (!transactions || transactions.length === 0) return 0;
  
  // Extrahujeme jadro názvu pre fuzzy matching
  const coreName = company.name.toLowerCase().replace(/,.*$/, '').replace(/ a\.s\.| s\.r\.o\.| spol\. s r\. o\./g, '').trim();
  
  return transactions.reduce((acc, row) => {
    if (row.supplier && row.supplier.name && row.supplier.name.toLowerCase().includes(coreName)) {
      return acc + (row.amount_eur || 0);
    }
    return acc;
  }, 0);
}

async function run() {
  console.log("🕵️‍♂️ Krtko: Sťahujem dáta REÁLNYM SCRAPINGOM z webu (Fáza 7.1)...");
  
  for (const company of targetCompanies) {
    console.log(`- Skúmam web pre IČO: ${company.ico}...`);
    
    let { profit, year } = await scrapeFinstatProfit(company.ico);
    if (profit === null) {
      console.log(`  [VAROVANIE] Hodnotu sa nepodarilo vycrawlovať. Nasadená Captcha alebo nová štruktúra.`);
      profit = 0; // fallback v pripade nepreniknutia
    } else {
      console.log(`  [ÚSPECH] Nájdený reálny zisk/strata (Live) za rok ${year}: ${profit} EUR`);
    }

    const subsidy = await getCitySubsidyFromCRZ(company.ico, year);

    const record = {
      name: company.name,
      ico: company.ico,
      type: company.type,
      profit_loss_eur: profit,
      city_subsidy_eur: subsidy,
      finstat_url: `https://finstat.sk/${company.ico}`,
      year: year
    };

    const { data: existing } = await supabase
      .from('city_companies')
      .select('id')
      .eq('ico', company.ico)
      .eq('year', year)
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
