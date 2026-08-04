const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function parseRealPublicationDatesFast() {
  console.log("🚀 Spúšťam RÝCHLU paralelnú opravu dátumov zverejnenia zmlúv z CRZ...");

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, external_id, source_url, date_published')
    .eq('source_type', 'CRZ_CONTRACT');

  if (error) {
    console.error("Chyba pri načítavaní transakcií:", error);
    return;
  }

  console.log(`📋 Nájdených ${transactions.length} CRZ zmlúv na opravenie dátumu...`);
  let updatedCount = 0;
  const BATCH_SIZE = 25;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (tx) => {
      if (!tx.source_url) return;
      try {
        const res = await fetch(tx.source_url);
        if (!res.ok) return;
        const html = await res.text();

        const match = html.match(/Dátum zverejnenia:[\s\S]*?(\d{2})\.(\d{2})\.(\d{4})/i);
        if (match) {
          const day = match[1];
          const month = match[2];
          const year = match[3];
          const realDateISO = `${year}-${month}-${day}`;

          if (tx.date_published !== realDateISO) {
            await supabase
              .from('transactions')
              .update({ date_published: realDateISO })
              .eq('id', tx.id);
            updatedCount++;
          }
        }
      } catch (err) {}
    }));
    console.log(`⚡ Spracovaných ${Math.min(i + BATCH_SIZE, transactions.length)}/${transactions.length} zmlúv (aktualizovaných dátumov: ${updatedCount})`);
  }

  console.log(`🎉 DOKONČENÉ! Úspešne aktualizovaných dátumov zmlúv: ${updatedCount}`);
}

parseRealPublicationDatesFast();
