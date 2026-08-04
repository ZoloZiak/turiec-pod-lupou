const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 1. Zoznam známych štátnych inštitúcií, bánk a veľkých podnikov
const KNOWN_MAPPINGS = {
  'ministerstvo investícií, regionálneho rozvoja a informatizácie slovenskej republiky': '50349287',
  'slovenská sporiteľňa, a.s.': '00151653',
  'mesto martin': '00316741',
  'dopravný podnik mesta martin, s.r.o.': '53560922',
  'dopravný podnik mesta martin, s. r. o.': '53560922',
  'tucon, a.s,': '36423086',
  'tucon, a.s.': '36423086',
  '3 energy sk, s.r.o.': '51039508',
  '3 energy sk s.r.o.': '51039508',
  'štátny fond rozvoja bývania': '31749504',
  'enviromentálny fond': '30853828',
  'environmentálny fond': '30853828',
  'ministerstvo životného prostredia slovenskej republiky': '42181810',
  'ministerstvo dopravy sr': '30416094',
  'ministerstvo dopravy slovenskej republiky': '30416094',
  'combin banská štiavnica, s.r.o.': '36056341',
  'fond na podporu športu': '52870197',
  'ministerstvo práce, sociálnych vecí a rodiny slovenskej republiky': '00681156',
  'alam s.r.o.': '35905204',
  'úrad práce, sociálnych vecí a rodiny martin': '30794536',
  'adfex, a.s.': '36798087',
  'mesto vrútky': '00317021',
  'československá obchodná banka, a.s.': '36854140',
  'poh, s.r.o. "registrovaný sociálny podnik"': '36399124',
  'poh, s. r. o. ˝registrovaný sociálny podnik˝': '36399124',
  'ministerstvo vnútra slovenskej republiky (sekcia európskych programov mv sr)': '00000868',
  'ministerstvo vnútra slovenskej republiky': '00000868',
  'dopstav obchodná a stavebná spoločnosť s.r.o.': '36399728',
  'všeobecná úverová banka, a.s.': '31320155',
  'vúb,a.s.': '31320155',
  'stavgor s.r.o. registrovaný sociálny podnik': '52417751',
  'premium insurance company limited, pobočka poisťovne z iného členského štátu': '50250689',
  'úrad vlády sr': '00151513',
  'úrad vlády slovenskej republiky': '00151513',
  'corex servis': '36400971',
  'corex s.r.o.': '36400971',
  'ministerstvo hospodárstva slovenskej republiky': '00686832',
  'unicredit bank czech republic and slovakia, a.s., pobočka zahraničnej banky': '47251336',
  'ministerstvo financií slovenskej republiky': '00000604',
  'k&k technology a.s.': '36423019',
  'k&amp;k technology a.s.': '36423019',
  'orange slovensko. a.s.': '35697270',
  'orange slovensko, a.s.': '35697270',
  'tichý, s.r.o.': '36438784',
  'brantner fatra s.r.o.': '31578861',
  'doxx - stravné lístky, spol. s r.o.': '36396567',
  'doxx-stravné lístky, spol. s r.o.': '36396567',
  'stefe martin, a.s.': '36395714',
  'martinská parkovacia spoločnosť, a.s.': '36387959',
  'sociálny podnik mesta martin, s. r. o.': '53584244',
  'správa športových zariadení mesta martin': '37905185',
  'kultúrna scéna martin': '53560795',
  'oblastná organizácia cestovného ruchu turiec': '42220360',
  'turčianska vodárenská spoločnosť, a.s.': '36402691'
};

/**
 * Hľadá IČO cez RÚZ (Register účtovných závierok API - www.ruz.sk)
 */
async function searchIcoViaRuz(name) {
  const cleanName = name
    .replace(/&quot;|&amp;|˝|"/g, '')
    .replace(/,?\s*(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol\.?\s*s\.?\s*r\.?\s*o\.?|k\.?\s*s\.?)$/i, '')
    .trim();

  if (cleanName.length < 3) return null;

  try {
    const url = `https://www.ruz.sk/api/uctovne-jednotky?nazov=${encodeURIComponent(cleanName)}&max-vysledkov=5`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id && data.id.length > 0) {
        // Získať detail prvej účtovnej jednotky
        const detailUrl = `https://www.ruz.sk/api/uctovna-jednotka?id=${data.id[0]}`;
        const detailRes = await fetch(detailUrl);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          if (detail && detail.ico) {
            return detail.ico.padStart(8, '0');
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Hľadá IČO cez RPVS (Register partnerov verejného sektora API)
 */
async function searchIcoViaRpvs(name) {
  const cleanName = name
    .replace(/&quot;|&amp;|˝|"/g, '')
    .replace(/,?\s*(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol\.?\s*s\.?\s*r\.?\s*o\.?|k\.?\s*s\.?)$/i, '')
    .trim();

  if (cleanName.length < 3) return null;

  try {
    const url = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanName)}`;
    const res = await fetch(url);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const partner = list.find(p => p.TypOsoby === 'Partner verejného sektora' && p.Ico);
        if (partner && partner.Ico) {
          return partner.Ico.padStart(8, '0');
        }
      }
    }
  } catch (e) {}
  return null;
}

async function resolveAllUnknownIcos() {
  console.log("🚀 Spúšťam masové dopárovanie a zlúčenie neznámych IČO pre Turiec pod Lupou...");

  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, ico');

  if (error) {
    console.error("Chyba pri načítaní entities:", error);
    return;
  }

  const unknownEntities = entities.filter(e => !e.ico || e.ico.startsWith('NO_ICO_'));
  console.log(`📋 Počet subjektov bez platného IČO: ${unknownEntities.length}`);

  let resolvedCount = 0;
  let mergedCount = 0;

  for (let i = 0; i < unknownEntities.length; i++) {
    const ent = unknownEntities[i];
    const normName = ent.name.toLowerCase().trim();

    let resolvedIco = KNOWN_MAPPINGS[normName] || null;

    if (!resolvedIco) {
      resolvedIco = await searchIcoViaRpvs(ent.name);
    }

    if (!resolvedIco) {
      resolvedIco = await searchIcoViaRuz(ent.name);
    }

    if (resolvedIco) {
      resolvedCount++;
      console.log(`\n✨ [${i + 1}/${unknownEntities.length}] Dopárované IČO pre "${ent.name}": [${ent.ico}] -> [${resolvedIco}]`);

      // Overiť, či už existuje entita s týmto IČO v databáze
      const { data: existing } = await supabase
        .from('entities')
        .select('id')
        .eq('ico', resolvedIco)
        .neq('id', ent.id)
        .single();

      if (existing) {
        // Zlúčiť transakcie na existujúcu entitu a vymazať duplikát
        await supabase.from('transactions').update({ supplier_entity_id: existing.id }).eq('supplier_entity_id', ent.id);
        await supabase.from('transactions').update({ buyer_entity_id: existing.id }).eq('buyer_entity_id', ent.id);
        await supabase.from('entities').delete().eq('id', ent.id);
        mergedCount++;
        console.log(`  ↪ Zlúčené transakcie na existujúcu entitu (ID: ${existing.id})`);
      } else {
        await supabase.from('entities').update({ ico: resolvedIco }).eq('id', ent.id);
        console.log(`  ↪ Priamo aktualizované IČO v databáze.`);
      }
    }
  }

  console.log(`\n🎉 HOTOVO! Úspešne vyriešených IČO: ${resolvedCount}, Zlúčených duplicitných subjektov: ${mergedCount}`);
}

resolveAllUnknownIcos();
