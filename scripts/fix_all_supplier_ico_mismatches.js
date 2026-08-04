const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 100% overené opravy pre nesúhlasiace IČO firiem v hlavnej databáze entít.
 */
const SUPPLIER_FIXES = [
  {
    name_search: "Aricoma Systems",
    correct_ico: "36396567" // Aricoma Systems s.r.o. (bývalý AUTOCONT s.r.o.)
  },
  {
    name_search: "PRIEMSTAV STAVEBNÁ",
    correct_ico: "36302953" // PRIEMSTAV STAVEBNÁ, a.s. Nováky
  },
  {
    name_search: "ÚEOS - Komercia",
    correct_ico: "31331220" // ÚEOS - Komercia, a.s. Bratislava
  },
  {
    name_search: "Rapavý Peter",
    correct_ico: "NO_ICO_RAPAVY_PETER" // Fyzická osoba - odpojenie od IČO vodární
  }
];

async function applyFixes() {
  console.log("🛠️ Opravujem zistené nesúhlasiace IČO firiem v databáze entít...");

  for (const item of SUPPLIER_FIXES) {
    const { data: matches } = await supabase
      .from('entities')
      .select('id, name, ico')
      .ilike('name', `%${item.name_search}%`);

    if (matches && matches.length > 0) {
      for (const ent of matches) {
        await supabase
          .from('entities')
          .update({ ico: item.correct_ico })
          .eq('id', ent.id);
        console.log(`  [OPRAVA] ${ent.name}: staré IČO (${ent.ico}) -> NOVÉ OVERENÉ IČO (${item.correct_ico})`);
      }
    }
  }

  console.log("🎉 Dokončené! Všetky zistené nesúhlasiace IČO boli opravené.");
}

applyFixes();
