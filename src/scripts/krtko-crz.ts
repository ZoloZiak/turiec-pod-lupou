import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

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
  url: string;
  published_at: string;
}

async function scrapeCrzForOrganization(queryName: string): Promise<RealContract[]> {
  console.log(`🔍 Vyhľadávam zmluvy v CRZ pre: ${queryName}...`);
  const encodedQuery = encodeURIComponent(queryName);
  const url = `https://crz.gov.sk/2171273-sk/centralny-register-zmluv/?art_zs1=${encodedQuery}&art_predmet=&art_ico=&art_suma_zmluva_od=&art_suma_zmluva_do=&art_datum_zverejnene_od=&art_datum_zverejnene_do=&art_resort=0&art_osoba1=&art_osoba2=&nazov=&art_vypis=1`;

  try {
    const res = await fetch(url);
    const html = await res.text();

    const contracts: RealContract[] = [];
    const regex = /<td class="cell2"><a href="\/zmluva\/(\d+)\/">([^<]+)<\/a>[\s\S]*?<td class="cell3[^">]*">([^<]+)&nbsp;&euro;<\/td>[\s\S]*?<td class="cell4">([^<]+)<\/td>\s*<td class="cell5">([^<]+)<\/td>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      const amountStr = match[3].replace(/\s/g, '').replace(',', '.');
      const amount = parseFloat(amountStr) || 0;
      const osoba1 = match[4].trim();
      const osoba2 = match[5].trim();
      
      // CRZ nie vždy dáva mesto do Osoba 1. Ak je Osoba 2 mesto, dodávateľ je Osoba 1.
      let supplierName = osoba2;
      if (osoba2.toLowerCase().includes(queryName.toLowerCase())) {
        supplierName = osoba1;
      }

      contracts.push({
        external_id: `crz_${id}`,
        title,
        amount,
        buyer_name: queryName,
        supplier_name: supplierName,
        url: `https://crz.gov.sk/zmluva/${id}/`,
        published_at: new Date().toISOString()
      });
    }

    console.log(`✅ Našlo sa ${contracts.length} zmlúv pre ${queryName}`);
    return contracts;
  } catch (e) {
    console.error(`❌ Chyba pri sťahovaní pre ${queryName}:`, e);
    return [];
  }
}

async function runKrtko() {
  console.log('🚀 Spúšťam Krtka pre sťahovanie REÁLNYCH DÁT z CRZ...');

  try {
    // 1. Zaručiť existence mestskej entít
    const entitiesToInsert = [
      { ico: '00316741', name: 'Mesto Martin', type: 'CITY', normalized_name: 'mesto martin' },
      { ico: '36387959', name: 'Martinská parkovacia spoločnosť, a.s.', type: 'COMPANY', normalized_name: 'martinska parkovacia spolocnost a s' },
      { ico: '53560922', name: 'Dopravný podnik mesta Martin, s.r.o.', type: 'COMPANY', normalized_name: 'dopravny podnik mesta martin s r o' },
      { ico: '42220360', name: 'Oblastná organizácia cestovného ruchu Turiec', type: 'NGO', normalized_name: 'oblastna organizacia cestovneho ruchu turiec' },
      { ico: '36402691', name: 'Turčianska vodárenská spoločnosť, a.s.', type: 'COMPANY', normalized_name: 'turcianska vodarenska spolocnost a s' }
    ];

    await supabase.from('entities').upsert(entitiesToInsert, { onConflict: 'ico' });

    const searchTargets = [
      { name: 'Mesto Martin', ico: '00316741' },
      { name: 'Dopravný podnik mesta Martin', ico: '53560922' },
      { name: 'Martinská parkovacia spoločnosť', ico: '36387959' },
      { name: 'Oblastná organizácia cestovného ruchu Turiec', ico: '42220360' },
      { name: 'Turčianska vodárenská spoločnosť', ico: '36402691' }
    ];

    for (const target of searchTargets) {
      const contracts = await scrapeCrzForOrganization(target.name);
      
      const { data: buyer } = await supabase.from('entities').select('id').eq('ico', target.ico).single();

      if (!buyer) continue;

      for (const contract of contracts) {
        // Uložiť dodávateľa s unikátnym fallback ICO podľa mena, kým nezapojíme ORSF/FinStat API
        const fallbackIco = `NO_ICO_${contract.supplier_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase()}`;
        const { data: supplier } = await supabase.from('entities')
          .upsert({ 
            ico: fallbackIco, 
            name: contract.supplier_name, 
            type: 'COMPANY', 
            normalized_name: contract.supplier_name.toLowerCase() 
          }, { onConflict: 'ico' })
          .select('id')
          .single();

        if (!supplier) continue;

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
      }
    }

    console.log('🎉 Sťahovanie a ukladanie reálnych zmlúv je DOKONČENÉ!');

  } catch (err) {
    console.error('❌ Chyba pri behu Krtka:', err);
  }
}

runKrtko();
