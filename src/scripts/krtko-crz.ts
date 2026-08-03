import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as cheerio from 'cheerio';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče v .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RealContract {
  external_id: string;
  title: string;
  amount: number;
  buyer_name: string;
  supplier_name: string;
  supplier_ico?: string | null;
  url: string;
  published_at: string;
}

async function scrapeCrzForOrganization(queryName: string): Promise<RealContract[]> {
  const startDate = process.env.SCAN_START_DATE || "";
  const endDate = process.env.SCAN_END_DATE || "";
  console.log(`🔍 Vyhľadávam zmluvy v CRZ pre: ${queryName}${startDate ? ` od ${startDate}` : ""}${endDate ? ` do ${endDate}` : ""}...`);
  let allContracts: RealContract[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const encodedQuery = encodeURIComponent(queryName);
    // CRZ Stránkovanie: prvú stranu môžeme nechať bez page alebo page=0, druhú page=1
    const pageParam = page > 0 ? `&page=${page}` : '';
    const url = `https://crz.gov.sk/2171273-sk/centralny-register-zmluv/?art_zs1=${encodedQuery}&art_predmet=&art_ico=&art_suma_zmluva_od=&art_suma_zmluva_do=&art_datum_zverejnene_od=${startDate}&art_datum_zverejnene_do=${endDate}&art_resort=0&art_osoba1=&art_osoba2=&nazov=&art_vypis=1${pageParam}`;

    try {
      const res = await fetch(url);
      const html = await res.text();

      const regex = /<td class="cell2"><a href="\/zmluva\/(\d+)\/">([^<]+)<\/a>[\s\S]*?<td class="cell3[^">]*">([^<]+)&nbsp;&euro;<\/td>[\s\S]*?<td class="cell4">([^<]+)<\/td>\s*<td class="cell5">([^<]+)<\/td>/g;
      
      let match;
      let countOnPage = 0;
      const contractPromises = [];

      while ((match = regex.exec(html)) !== null) {
        countOnPage++;
        const id = match[1];
        const title = match[2].trim();
        const amountStr = match[3].replace(/\\s/g, '').replace(',', '.');
        const amount = parseFloat(amountStr) || 0;
        const osoba1 = match[4].trim();
        const osoba2 = match[5].trim();
        
        let supplierName = osoba2;
        if (osoba2.toLowerCase().includes(queryName.toLowerCase())) {
          supplierName = osoba1;
        }

        // Paralerizované sťahovanie detailov
        const fetchDetail = async () => {
          let realIco = null;
          try {
            const detailRes = await fetch(`https://crz.gov.sk/zmluva/${id}/`);
            const detailHtml = await detailRes.text();
            const $ = cheerio.load(detailHtml);
            const icos: string[] = [];
            $('strong').each((i, el) => {
              if ($(el).text().includes('IČO:')) {
                icos.push($(el).next('span').text().trim());
              }
            });
            if (icos.length > 0) realIco = icos[icos.length - 1]; 
          } catch(e) {
             console.error("Nedalo sa ziskat detail pre " + id);
          }
          return {
            external_id: `crz_${id}`,
            title,
            amount,
            buyer_name: queryName,
            supplier_name: supplierName,
            supplier_ico: realIco, 
            url: `https://crz.gov.sk/zmluva/${id}/`,
            published_at: new Date().toISOString()
          };
        };

        contractPromises.push(fetchDetail());
      }

      // Spusti vsetky dopyty na detaily zmluv pre danu stranu sucasne (parallel)
      const pageContracts = await Promise.all(contractPromises);
      allContracts.push(...pageContracts);

      console.log(`Strana ${page + 1}: nájdených ${countOnPage} zmlúv (paralelne spracované).`);
      
      if (countOnPage === 0 || page >= 1) { 
        hasMore = false;
      } else {
        page++;
      }
    } catch (e) {
      console.error(`❌ Chyba pri sťahovaní pre ${queryName} na strane ${page + 1}:`, e);
      hasMore = false;
    }
  }

  console.log(`✅ Celkovo sa našlo ${allContracts.length} zmlúv pre ${queryName}`);
  return allContracts;
}

async function runKrtko() {
  console.log('🚀 Spúšťam Krtka pre sťahovanie REÁLNYCH DÁT z CRZ...');
  await supabase.from('system_logs').insert({ source: 'CRZ_KRTKO', message: 'Spúšťam sťahovanie dát z CRZ...' });

  try {
    // 1. Zaručiť existence mestskej entít
    const entitiesToInsert = [
      { ico: '00316741', name: 'Mesto Martin', type: 'MUNICIPALITY', normalized_name: 'mesto martin' },
      { ico: '36387959', name: 'Martinská parkovacia spoločnosť, a.s.', type: 'COMPANY', normalized_name: 'martinska parkovacia spolocnost a s' },
      { ico: '53560922', name: 'Dopravný podnik mesta Martin, s.r.o.', type: 'COMPANY', normalized_name: 'dopravny podnik mesta martin s r o' },
      { ico: '42220360', name: 'Oblastná organizácia cestovného ruchu Turiec', type: 'NGO', normalized_name: 'oblastna organizacia cestovneho ruchu turiec' },
      { ico: '36402691', name: 'Turčianska vodárenská spoločnosť, a.s.', type: 'COMPANY', normalized_name: 'turcianska vodarenska spolocnost a s' },
      { ico: '52402126', name: 'Sociálny podnik mesta Martin, s. r. o.', type: 'COMPANY', normalized_name: 'socialny podnik mesta martin s r o' },
      { ico: '37905185', name: 'Správa športových zariadení mesta Martin', type: 'COMPANY', normalized_name: 'sprava sportovych zariadeni mesta martin' },
      { ico: '53560795', name: 'Kultúrna scéna Martin', type: 'NGO', normalized_name: 'kulturna scena martin' }
    ];

    await supabase.from('entities').upsert(entitiesToInsert, { onConflict: 'ico' });

    const searchTargets = [
      { name: 'Mesto Martin', ico: '00316741' },
      { name: 'Dopravný podnik mesta Martin', ico: '53560922' },
      { name: 'Martinská parkovacia spoločnosť', ico: '36387959' },
      { name: 'Oblastná organizácia cestovného ruchu Turiec', ico: '42220360' },
      { name: 'Turčianska vodárenská spoločnosť', ico: '36402691' },
      { name: 'Sociálny podnik mesta Martin', ico: '52402126' },
      { name: 'Správa športových zariadení mesta Martin', ico: '37905185' },
      { name: 'Kultúrna scéna Martin', ico: '53560795' }
    ];

    // Spustime vsetky organizacie paralelne (namiesto for...of)
    await Promise.all(searchTargets.map(async (target) => {
      const contracts = await scrapeCrzForOrganization(target.name);
      
      const { data: buyer } = await supabase.from('entities').select('id').eq('ico', target.ico).single();

      if (!buyer) return;

      // Hromadne ulozenie zmluv pre dany podniku (vnutorna paralerizacia)
      await Promise.all(contracts.map(async (contract) => {
        const fallbackIco = (contract as any).supplier_ico || `NO_ICO_${contract.supplier_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase()}`;
        const { data: supplier } = await supabase.from('entities')
          .upsert({ 
            ico: fallbackIco, 
            name: contract.supplier_name, 
            type: 'COMPANY', 
            normalized_name: contract.supplier_name.toLowerCase() 
          }, { onConflict: 'ico' })
          .select('id')
          .single();

        if (!supplier) return;

        await supabase.from('transactions').upsert({
          external_id: contract.external_id,
          source_type: 'CRZ_CONTRACT',
          source_url: contract.url,
          buyer_entity_id: buyer.id,
          supplier_entity_id: supplier.id,
          amount_eur: contract.amount,
          date_published: contract.published_at,
          subject: contract.title
        }, { onConflict: 'external_id' });
      }));
    }));

    console.log('🎉 Sťahovanie a ukladanie reálnych zmlúv je DOKONČENÉ!');
    await supabase.from('system_logs').insert({ source: 'CRZ_KRTKO', message: 'Sťahovanie dokončené úspešne.' });

  } catch (err: any) {
    console.error('❌ Chyba pri behu Krtka:', err);
    await supabase.from('system_logs').insert({ source: 'CRZ_KRTKO', message: 'Kritická chyba pri behu skriptu', parsed_data: { error: err.message } });
  }
}

runKrtko();
