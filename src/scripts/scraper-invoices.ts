import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// --- INITIALIZATION ---
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče v .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- INTERFACES ---
interface InvoiceData {
  external_id: string; // Unikátne ID faktúry na webe (napr. číslo faktúry)
  title: string;       // Predmet faktúry
  amount: number;      // Suma
  supplier_name: string; // Dodávateľ
  published_at: string;  // Dátum
  url: string;         // Link na web, odkiaľ to máme
}

// --- SCRAPER PLUGIN: WEB FAKTÚRY MESTSKÝCH PODNIKOV ---
// BEZPEČNÝ NO-OP (2026-08-25, audit WATCH tik #7).
//
// PÔVODNE tento scraper NEROBIL reálny fetch — mal zakomentovaný `fetch()` a namiesto neho
// vkladal do produkčnej DB `mockHtml` s vymyslenými faktúrami (FA-2026/0801-0803, dodávatelia
// "Servis a.s." / "Papiernictvo s.r.o." / "Cestné stavby Martin"). Tie sa cez 3 zdroje
// replikovali na 9 FABRIKOVANÝCH transakcií na transparentnom webe (zmazané commitom cleanupu).
// Zdrojová stránka parkovaniemartin.sk/faktury-a-objednavky navyše NEEXISTUJE (503, 0 Wayback
// snapshotov; doména sa presunula na parkovanie-martin.sk, kde faktúrová podstránka nie je).
//
// Kým nebude implementovaný a overený REÁLNY HTML parser pre KONKRÉTNU štruktúru každého webu,
// tento plugin ZÁMERNE nevracia nič — radšej prázdny modul než fabrikát na transparentnom webe.
// Reálna implementácia: odkomentovať fetch, naparsovať skutočnú tabuľku, dohľadať IČO dodávateľa
// (nie NO_ICO_ fallback z mena), overiť sumy proti zdroju. Framework InvoiceData ostáva pripravený.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function scrapeInvoices(targetUrl: string, _buyerIco: string): Promise<InvoiceData[]> {
  console.log(`\n🕷️ [Scraper] NO-OP: reálny parser pre ${targetUrl} nie je implementovaný — nevkladám žiadne dáta (žiadny mock/fabrikát).`);
  // cheerio ostáva importované pre budúci reálny parser; teraz sa nepoužíva.
  void cheerio;
  return [];
}


// --- MAIN DATA PIPELINE ---
async function runInvoiceSanitizerPipeline() {
  console.log('🚀 Spúšťam modul "Sanitizer" pre neštruktúrované dáta z viacerých webov...');
  await supabase.from('system_logs').insert({ source: 'WEB_SCRAPER', message: 'Spúšťam sťahovanie faktúr z webov...' });
  
  const sources = [
    { buyerIco: '36387959', targetWeb: 'https://www.parkovaniemartin.sk/faktury-a-objednavky' },
    { buyerIco: '53560922', targetWeb: 'https://www.dpmmartin.sk/zverejnovanie/faktury' },
    { buyerIco: '42220360', targetWeb: 'https://turiec.com/dokumenty-faktury-objednavky' }
  ];

  for (const source of sources) {
    const { buyerIco, targetWeb } = source;
    
    // 1. Získať ID kupujúceho z databázy
    const { data: buyer } = await supabase.from('entities').select('id').eq('ico', buyerIco).single();
    if (!buyer) {
      console.error(`Kupujúci s IČO ${buyerIco} neexistuje v DB. Prerušujem spracovanie pre ${targetWeb}.`);
      continue;
    }

    // 2. Extrahovať dáta
    const invoices = await scrapeInvoices(targetWeb, buyerIco);
    await supabase.from('system_logs').insert({ 
      source: 'WEB_SCRAPER', 
      message: `Z webu ${targetWeb} stiahnutých ${invoices.length} faktúr`,
      parsed_data: { buyerIco, targetWeb, count: invoices.length }
    });

  // 3. Ukladacia vrstva s deduplikáciou dodávateľov (Krok 2 z Master Planu - Čistiaca vrstva)
  for (const inv of invoices) {
    // Keďže z webu nemáme IČO, vygenerujeme deterministické IČO na základe mena dodávateľa,
    // aby sa všetky faktúry "Servis a.s." priradili rovnakému dodávateľovi a nevytvárali sa duplicity.
    const fallbackIco = `NO_ICO_${inv.supplier_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase()}`;
    
    // UPSERT dodávateľa
    const { data: supplier } = await supabase.from('entities')
      .upsert({ 
        ico: fallbackIco, 
        name: inv.supplier_name, 
        type: 'COMPANY', 
        normalized_name: inv.supplier_name.toLowerCase() 
      }, { onConflict: 'ico' })
      .select('id')
      .single();

    if (!supplier) continue;

    // UPSERT faktúry do zjednotenej tabuľky 'transactions'
    const { error: txError } = await supabase.from('transactions').upsert({
      external_id: inv.external_id,
      source_type: 'WEB_INVOICE', // Dôležité: odlišujeme od CRZ_CONTRACT
      source_url: inv.url,
      buyer_entity_id: buyer.id,
      supplier_entity_id: supplier.id,
      amount_eur: inv.amount,
      date_published: inv.published_at,
      subject: inv.title
    }, { onConflict: 'external_id' });

    if (txError) {
      console.error(`Chyba pri zápise faktúry ${inv.external_id}:`, txError.message);
    }
    }
  }

  console.log('🎉 Modul na neštruktúrované dáta úspešne dokončil prácu pre všetky zdroje!');
  await supabase.from('system_logs').insert({ source: 'WEB_SCRAPER', message: 'Sťahovanie faktúr dokončené úspešne.' });
}

runInvoiceSanitizerPipeline();
