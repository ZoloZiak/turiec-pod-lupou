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
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullAuditThrottled() {
  console.log("🕵️‍♂️ Krtko: Spúšťam PRECIZNY AUDIT VŠETKÝCH firiem v databáze (s pauzou pre FinStat API)...");

  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, ico')
    .order('name');

  if (error) {
    console.error("Chyba pri načítavaní entít:", error);
    return;
  }

  const realEntities = entities.filter(e => e.ico && !e.ico.startsWith('NO_ICO_') && e.ico.length === 8);
  console.log(`📋 Nájdených ${realEntities.length} entít s 8-miestnym IČO na kompletnú kontrolu.`);

  const mismatches = [];
  let matchCount = 0;

  for (let i = 0; i < realEntities.length; i++) {
    const e = realEntities[i];
    try {
      const res = await fetch(`https://finstat.sk/${e.ico}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });

      if (!res.ok) {
        mismatches.push({ entity: e, reason: `FinStat HTTP ${res.status}` });
        process.stdout.write("⚠️");
        await sleep(300);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const finstatTitle = $('h1').first().text().trim();

      if (!finstatTitle || finstatTitle.includes('404')) {
        mismatches.push({ entity: e, reason: 'FinStat 404 / Nenájdené' });
        process.stdout.write("❓");
        await sleep(300);
        continue;
      }

      // Slová pre zhodu
      const cleanDb = e.name.toLowerCase().replace(/,/g, '').replace(/s\.r\.o\./g, '').replace(/a\.s\./g, '').trim();
      const firstWord = cleanDb.split(/\s+/).find(w => w.length > 3 && !['spol', 'sro', 'voa', 'obchodné', 'spoločnosť'].includes(w));

      if (firstWord && !finstatTitle.toLowerCase().includes(firstWord)) {
        mismatches.push({ entity: e, finstatTitle, reason: `Nesúhlasí názov: DB "${e.name}" vs FinStat "${finstatTitle}"` });
        process.stdout.write("❌");
      } else {
        matchCount++;
        process.stdout.write("✓");
      }
    } catch (err) {
      mismatches.push({ entity: e, reason: err.message });
      process.stdout.write("E");
    }

    await sleep(200); // 200ms pauza
  }

  console.log("\n\n==================================================");
  console.log(`✅ OVERENÉ KOREKTNÉ ZHODY: ${matchCount}`);
  console.log(`🚨 NESÚHLASIACE / CHYBNE SPÁROVANÉ IČO: ${mismatches.length}`);
  console.log("==================================================\n");

  if (mismatches.length > 0) {
    console.log("Zoznam nesúhlasiacich firiem a neplatných IČO:");
    mismatches.forEach(m => {
      console.log(`❌ DB Name: "${m.entity.name}" (IČO: ${m.entity.ico}) | Dôvod/FinStat: ${m.finstatTitle || m.reason}`);
    });
  }
}

runFullAuditThrottled();
