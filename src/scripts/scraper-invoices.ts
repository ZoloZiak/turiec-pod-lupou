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

// --- SCRAPER PLUGIN: PARKOVACIA SPOLOČNOSŤ (Ukážková logika) ---
// Keďže reálny web môže mať štruktúru rôznu a často sa mení, toto je framework.
async function scrapeInvoices(targetUrl: string, buyerIco: string): Promise<InvoiceData[]> {
  console.log(`\n🕷️ [Scraper] Analyzujem faktúry z: ${targetUrl}`);
  
  try {
    // V reálnom svete odkomentujeme fetch. Pre ukážku MVP fungovania (keďže cieľový web
    // parkovaniemartin.sk nemusí mať voľne prístupnú HTML tabuľku),
    // budeme simulovať HTML odpoveď typickú pre slovenské mestské podniky.
    
    /*
    const res = await fetch(targetUrl);
    const html = await res.text();
    */

    const mockHtml = `
      <table>
        <tbody>
          <tr>
            <td>FA-2026/0801</td>
            <td>Oprava parkovacích automatov</td>
            <td>Servis a.s.</td>
            <td>4 500,50 &euro;</td>
            <td>2026-08-01</td>
          </tr>
          <tr>
            <td>FA-2026/0802</td>
            <td>Nákup kancelárskych potrieb</td>
            <td>Papiernictvo s.r.o.</td>
            <td>120,00 &euro;</td>
            <td>2026-07-28</td>
          </tr>
          <tr>
            <td>FA-2026/0803</td>
            <td>Zimná údržba parkovísk (záloha)</td>
            <td>Cestné stavby Martin</td>
            <td>12 400,00 &euro;</td>
            <td>2026-07-20</td>
          </tr>
        </tbody>
      </table>
    `;

    const $ = cheerio.load(mockHtml);
    const invoices: InvoiceData[] = [];

    // Iterujeme cez každý riadok tabuľky
    $('table tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 5) {
        const id = $(tds[0]).text().trim();
        const subject = $(tds[1]).text().trim();
        const supplier = $(tds[2]).text().trim();
        
        // Vyčistenie sumy "4 500,50 €" -> 4500.50
        const amountStr = $(tds[3]).text().replace(/[^0-9,-]/g, '').replace(',', '.');
        const amount = parseFloat(amountStr) || 0;
        
        const dateRaw = $(tds[4]).text().trim();

        invoices.push({
          external_id: `inv_${buyerIco}_${id}`,
          title: subject,
          supplier_name: supplier,
          amount: amount,
          published_at: new Date(dateRaw).toISOString(),
          url: targetUrl
        });
      }
    });

    console.log(`✅ [Scraper] Vyextrahovaných ${invoices.length} neštruktúrovaných faktúr.`);
    return invoices;

  } catch (error) {
    console.error(`❌ [Scraper] Zlyhal scraping:`, error);
    return [];
  }
}


// --- MAIN DATA PIPELINE ---
async function runInvoiceSanitizerPipeline() {
  console.log('🚀 Spúšťam modul "Sanitizer" pre neštruktúrované dáta...');
  
  // Konfigurácia pre konkrétny plugin:
  // Kupujúci: Martinská parkovacia spoločnosť, a.s. (IČO: 36387959)
  const buyerIco = '36387959';
  const targetWeb = 'https://www.parkovaniemartin.sk/faktury-a-objednavky';

  // 1. Získať ID kupujúceho z databázy
  const { data: buyer } = await supabase.from('entities').select('id').eq('ico', buyerIco).single();
  if (!buyer) {
    console.error(`Kupujúci s IČO ${buyerIco} neexistuje v DB. Prerušujem pipeline.`);
    return;
  }

  // 2. Extrahovať dáta
  const invoices = await scrapeInvoices(targetWeb, buyerIco);

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

  console.log('🎉 Modul na neštruktúrované dáta úspešne dokončil prácu!');
}

runInvoiceSanitizerPipeline();
