const { createClient } = require('@supabase/supabase-js');
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

function cleanNameForSearch(name) {
  if (!name) return '';
  return name
    .replace(/&quot;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/s\.r\.o\.|a\.s\.|spol\. s r\.o\.|s\. r\.o\.| o\.z\.| spolek| k\.s\.| v\.o\.s\./gi, '')
    .trim();
}

async function deepAuditAllIcos() {
  console.log("==================================================");
  console.log("🕵️‍♂️ KRTKO: SPÚŠŤAM HLBOKÝ AUDIT VŠETKÝCH 342 ENTÍT CEZ RÚZ API");
  console.log("==================================================\n");

  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, ico')
    .order('name');

  if (error) {
    console.error("Chyba pri načítaní entít z DB:", error);
    return;
  }

  const realEntities = entities.filter(e => e.ico && !e.ico.startsWith('NO_ICO_') && /^\d{8}$/.test(e.ico));
  console.log(`📋 Načítaných ${realEntities.length} entít s 8-miestnym IČO na preverenie.`);

  const suspicious = [];

  const BATCH_SIZE = 15;
  for (let i = 0; i < realEntities.length; i += BATCH_SIZE) {
    const batch = realEntities.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (e) => {
      try {
        // Query RÚZ API by ICO
        const ruzRes = await fetch(`https://www.ruzstat.sk/api/subjekty?ico=${e.ico}`);
        if (ruzRes.ok) {
          const ruzData = await ruzRes.json();
          if (ruzData.id && ruzData.id.length > 0) {
            const subRes = await fetch(`https://www.ruzstat.sk/api/subjekt?id=${ruzData.id[0]}`);
            if (subRes.ok) {
              const sub = await subRes.json();
              const officialName = sub.pravneMeno || '';

              const cleanDb = cleanNameForSearch(e.name).toLowerCase();
              const cleanOff = cleanNameForSearch(officialName).toLowerCase();

              const wordsDb = cleanDb.split(/\s+/).filter(w => w.length >= 3 && !['spol', 'sro', 'voa'].includes(w));
              const hasMatch = wordsDb.some(w => cleanOff.includes(w));

              if (!hasMatch && wordsDb.length > 0) {
                suspicious.push({ entity: e, officialName, reason: `Meno nesúhlasí: DB "${e.name}" vs RÚZ "${officialName}"` });
              }
            }
          } else {
            suspicious.push({ entity: e, officialName: 'Nenájdené v RÚZ', reason: 'IČO sa nenachádza v RÚZ' });
          }
        }
      } catch(err) {
        suspicious.push({ entity: e, officialName: err.message, reason: 'Chyba API' });
      }
    }));

    await sleep(100);
  }

  console.log(`\n==================================================`);
  console.log(`🚨 ZISTENÉ PODOZRENIA / NESÚHLASY: ${suspicious.length}`);
  console.log(`==================================================\n`);

  for (const s of suspicious) {
    console.log(`❌ DB: "${s.entity.name}" (IČO: ${s.entity.ico}) | ${s.reason}`);
    
    // Hľadať správne IČO v RÚZ podľa mena
    try {
      const searchName = cleanNameForSearch(s.entity.name);
      const searchRes = await fetch(`https://www.ruzstat.sk/api/subjekty?nazov=${encodeURIComponent(searchName)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.id && searchData.id.length > 0) {
          const subRes = await fetch(`https://www.ruzstat.sk/api/subjekt?id=${searchData.id[0]}`);
          if (subRes.ok) {
            const sub = await subRes.json();
            if (sub.ico && sub.ico !== s.entity.ico) {
              console.log(`   ✨ OPRAVA NÁJDENÁ: Skutočné IČO pre "${s.entity.name}" je ${sub.ico} (${sub.pravneMeno})`);
              
              // Slúčiť alebo aktualizovať v Supabase
              const { data: existing } = await supabase.from('entities').select('id').eq('ico', sub.ico);
              if (existing && existing.length > 0) {
                const targetId = existing[0].id;
                await supabase.from('transactions').update({ supplier_entity_id: targetId }).eq('supplier_entity_id', s.entity.id);
                await supabase.from('transactions').update({ buyer_entity_id: targetId }).eq('buyer_entity_id', s.entity.id);
                await supabase.from('entities').delete().eq('id', s.entity.id);
              } else {
                await supabase.from('entities').update({ ico: sub.ico, name: sub.pravneMeno }).eq('id', s.entity.id);
              }
            }
          }
        }
      }
    } catch(errFix) {}
  }

  console.log("\n🎉 HLBOKÝ AUDIT DOKONČENÝ.");
}

deepAuditAllIcos();
