const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Čistenie názvov pre prísne porovnanie
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/s\.r\.o\.|a\.s\.|spol\. s r\.o\.|s\. r\.o\.| štátny podnik| o\.z\.| š\.p\.| spolek| k\.s\.| v\.o\.s\./gi, '')
    .replace(/[^a-z0-9áäčďéíĺľňóôŕšťúýž]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function verifyEverySingleIco() {
  console.log("==================================================");
  console.log("🕵️‍♂️ KRTKO: SPÚŠŤAM NEKOMPROMISNÝ AUDIT KAŽDÉHO JEDNÉHO IČO");
  console.log("==================================================\n");

  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, ico')
    .order('name');

  if (error) {
    console.error("Chyba pri načítaní entít z DB:", error);
    return;
  }

  console.log(`📋 Načítaných celkovo ${entities.length} entít z databázy.`);

  const realEntities = entities.filter(e => e.ico && !e.ico.startsWith('NO_ICO_') && /^\d{8}$/.test(e.ico));
  console.log(`🔍 Nájdených ${realEntities.length} firiem a organizácií s 8-miestnym IČO.\n`);

  const mismatches = [];
  const fixes = [];
  let validCount = 0;

  const BATCH_SIZE = 20;

  for (let i = 0; i < realEntities.length; i += BATCH_SIZE) {
    const batch = realEntities.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (e) => {
      try {
        // RPVS API query by ICO
        const rpvsUrl = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${e.ico}`;
        const rpvsRes = await fetch(rpvsUrl);

        let officialName = null;
        let source = 'RPVS';

        if (rpvsRes.ok) {
          const list = await rpvsRes.json();
          if (Array.isArray(list) && list.length > 0) {
            officialName = list[0].MenoPartnera;
          }
        }

        // Ak nie je v RPVS, použiť RÚZ API
        if (!officialName) {
          try {
            const ruzUrl = `https://www.ruzstat.sk/api/subjekty?ico=${e.ico}`;
            const ruzRes = await fetch(ruzUrl);
            if (ruzRes.ok) {
              const ruzData = await ruzRes.json();
              if (ruzData.id && ruzData.id.length > 0) {
                const subRes = await fetch(`https://www.ruzstat.sk/api/subjekt?id=${ruzData.id[0]}`);
                if (subRes.ok) {
                  const subData = await subRes.json();
                  officialName = subData.pravneMeno;
                  source = 'RÚZ';
                }
              }
            }
          } catch(errRuz) {}
        }

        if (!officialName) {
          // Ak nebol v RPVS ani RÚZ, označiť na preverenie
          mismatches.push({ entity: e, officialName: 'Nenájdené v štátnom registri', source: 'NONE' });
          return;
        }

        const normDb = normalizeName(e.name);
        const normOfficial = normalizeName(officialName);

        const dbWords = normDb.split(' ').filter(w => w.length >= 3);
        const offWords = normOfficial.split(' ').filter(w => w.length >= 3);

        const hasMatchingWord = dbWords.some(w => normOfficial.includes(w)) || offWords.some(w => normDb.includes(w));

        if (!hasMatchingWord && dbWords.length > 0 && offWords.length > 0) {
          mismatches.push({ entity: e, officialName, source });
        } else {
          validCount++;
        }
      } catch (err) {
        mismatches.push({ entity: e, officialName: err.message, source: 'ERROR' });
      }
    }));
  }

  console.log("==================================================");
  console.log(`✅ PLATNÉ A OVERENÉ ZHODY: ${validCount} / ${realEntities.length}`);
  console.log(`🚨 PODOZRIVÉ / NESÚHLASIACE IČO: ${mismatches.length}`);
  console.log("==================================================\n");

  if (mismatches.length > 0) {
    console.log("DETEKČNÝ PROTOKOL NESÚHLASOV:");
    mismatches.forEach(m => {
      console.log(`❌ DB: "${m.entity.name}" (IČO: ${m.entity.ico}) !== Registre (${m.source}): "${m.officialName}"`);
    });
  }

  // Pre nesúhlasiace entity automaticky hľadať skutočné IČO v RÚZ/RPVS podľa mena
  if (mismatches.length > 0) {
    console.log("\n🛠️ AUTOKOREKCIA: Hľadám skutočné IČO pre detegované nesúhlasy...");
    for (const m of mismatches) {
      if (m.source === 'NONE' || m.officialName !== m.entity.name) {
        try {
          const cleanName = m.entity.name.replace(/&amp;/g, '&').replace(/s\.r\.o\.|a\.s\./gi, '').trim();
          const rpvsSearch = await fetch(`https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanName)}`).then(r => r.json());
          if (Array.isArray(rpvsSearch) && rpvsSearch.length > 0) {
            const found = rpvsSearch.find(p => p.Ico && p.Ico.length === 8);
            if (found) {
              console.log(`  ✨ Našiel som skutočné IČO pre "${m.entity.name}": ${found.Ico} (${found.MenoPartnera})`);
              await supabase.from('entities').update({ ico: found.Ico }).eq('id', m.entity.id);
            }
          }
        } catch(err) {}
      }
    }
  }
}

verifyEverySingleIco();
