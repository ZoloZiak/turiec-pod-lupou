const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function decodeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function cleanHtmlEntities() {
  console.log("🧹 KRTKO: Čistím surové HTML kódovanie (&quot;, &amp;) v celom Supabase...");

  // 1. Entities
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name');

  let entityFixed = 0;
  if (entities) {
    for (const e of entities) {
      const cleaned = decodeHtml(e.name);
      if (cleaned !== e.name) {
        await supabase
          .from('entities')
          .update({ name: cleaned })
          .eq('id', e.id);
        console.log(`  [ENTITY] "${e.name}" -> "${cleaned}"`);
        entityFixed++;
      }
    }
  }

  // 2. Transactions (subject field)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, subject');

  let txFixed = 0;
  if (transactions) {
    for (const t of transactions) {
      const cleaned = decodeHtml(t.subject);
      if (cleaned !== t.subject) {
        await supabase
          .from('transactions')
          .update({ subject: cleaned })
          .eq('id', t.id);
        txFixed++;
      }
    }
  }

  console.log("==================================================");
  console.log(`✅ OPRAVENÝCH ENTÍT (FIREM): ${entityFixed}`);
  console.log(`✅ OPRAVENÝCH TRANSAKCIÍ (ZMLÚV/FAKTÚR): ${txFixed}`);
  console.log("==================================================");
}

cleanHtmlEntities();
