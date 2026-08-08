import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
// @ts-expect-error pdf-parse nemá typové definície
import pdf from 'pdf-parse';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče v .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Zoznam vzorových URL adries s PDF faktúrami na testovanie
const pdfUrls: string[] = [
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
];

async function extractFromPdf(url: string) {
  console.log(`\n📄 Sťahujem PDF: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP chyba: ${res.status}`);
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const data = await pdf(buffer);
    const text = data.text;
    
    console.log(`✅ PDF úspešne prečítané (počet znakov: ${text.length})`);
    
    // Extrakcia pomocou Regex
    // IČO je na Slovensku zvyčajne 8-miestne číslo
    const icoMatch = text.match(/(?:IČO|ICO)[\s\:\.]*(\d{8})/i);
    const ico = icoMatch ? icoMatch[1] : null;
    
    // Suma zvyčajne obsahuje EUR, € a čísla s čiarkou
    // Hľadáme slová ako "Suma k úhrade", "Celkom", "Spolu"
    const sumMatch = text.match(/(?:k úhrade|spolu|celkom)[\s\:\.]*([\d\s]+[,.]\d{2})\s*(?:€|EUR)/i);
    let amountEur = 0;
    if (sumMatch) {
      amountEur = parseFloat(sumMatch[1].replace(/\s/g, '').replace(',', '.'));
    }

    if (ico && amountEur > 0) {
      console.log(`🎯 ÚSPECH: Nájdené IČO: ${ico}, Suma: ${amountEur}€`);
      
      // 1. Zabezpečiť entitu
      const fallbackName = `Neznáma firma z PDF (${ico})`;
      const { data: supplier } = await supabase.from('entities')
        .upsert({ ico: ico, name: fallbackName, type: 'COMPANY', normalized_name: fallbackName.toLowerCase() }, { onConflict: 'ico' })
        .select('id').single();
      
      const { data: buyer } = await supabase.from('entities').select('id').eq('ico', '00316792').single(); // Mesto Martin

      if (supplier && buyer) {
        // 2. Vytvoriť transakciu
        await supabase.from('transactions').upsert({
          external_id: `PDF_${Date.now()}_${ico}`,
          source_type: 'WEB_INVOICE',
          source_url: url,
          buyer_entity_id: buyer.id,
          supplier_entity_id: supplier.id,
          amount_eur: amountEur,
          date_published: new Date().toISOString(),
          subject: 'Faktúra vyťažená z PDF'
        }, { onConflict: 'external_id' });
        
        await supabase.from('system_logs').insert({ 
          source: 'PDF_EXTRACTOR', 
          message: `Úspešne vyťažená faktúra z PDF (IČO: ${ico}, Suma: ${amountEur}€).`
        });
      }

    } else {
      console.warn(`⚠️ ZLYHANIE: Nenašlo sa IČO alebo suma. Presúvam do manuálnej kontroly.`);
      // Vložíme do logov ako MANUAL_REVIEW_NEEDED
      await supabase.from('system_logs').insert({ 
        source: 'MANUAL_REVIEW_NEEDED', 
        message: 'Nepodarilo sa automaticky vyťažiť PDF.',
        parsed_data: { 
          url: url, 
          text_preview: text.substring(0, 1000), // Uložíme náhľad textu pre admina
          extracted_ico: ico,
          extracted_amount: amountEur
        }
      });
    }

  } catch (error: unknown) {
    console.error(`❌ Chyba pri spracovaní PDF: ${url}`, error);
    await supabase.from('system_logs').insert({ 
      source: 'MANUAL_REVIEW_NEEDED', 
      message: 'Súbor sa nedal stiahnuť alebo prečítať.',
      parsed_data: { url: url, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

async function runPdfExtractor() {
  console.log('🚀 Spúšťam Krtka pre extrakciu PDF faktúr (Regex)...');
  
  if (pdfUrls.length === 0) {
    console.log('ℹ️ Zoznam PDF je zatiaľ prázdny. Akonáhle nejaké pridáme, automatická extrakcia pobeží.');
    return;
  }

  for (const url of pdfUrls) {
    await extractFromPdf(url);
  }
}

runPdfExtractor();
