require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deduplicate() {
  console.log('🧹 Krtko: Spúšťam Fázu 5 (Deduplikácia dát)...');
  
  // Nájdi všetky NO_ICO_ entity
  const { data: dummyEntities } = await supabase
    .from('entities')
    .select('id, name, ico, normalized_name')
    .like('ico', 'NO_ICO_%');

  if (!dummyEntities || dummyEntities.length === 0) {
    console.log('✅ Žiadne duplicity nenájdené. Databáza je čistá.');
    return;
  }

  console.log(`Nájdených ${dummyEntities.length} nepotvrdených entít (NO_ICO_). Hľadám zhody...`);

  let mergedCount = 0;

  for (const dummy of dummyEntities) {
    // Hľadaj entitu s reálnym IČO s podobným menom
    const { data: realEntities } = await supabase
      .from('entities')
      .select('id, name, ico')
      .not('ico', 'like', 'NO_ICO_%')
      .ilike('normalized_name', `%${dummy.normalized_name.substring(0, 10)}%`)
      .limit(1);

    if (realEntities && realEntities.length > 0) {
      const realEntity = realEntities[0];
      console.log(`🔗 Zlučujem: [${dummy.name}] -> [${realEntity.name}] (IČO: ${realEntity.ico})`);

      // 1. Presuň všetky transakcie (buyer)
      await supabase.from('transactions')
        .update({ buyer_entity_id: realEntity.id })
        .eq('buyer_entity_id', dummy.id);

      // 2. Presuň všetky transakcie (supplier)
      await supabase.from('transactions')
        .update({ supplier_entity_id: realEntity.id })
        .eq('supplier_entity_id', dummy.id);

      // 3. Zmaž dummy entitu
      await supabase.from('entities').delete().eq('id', dummy.id);
      
      mergedCount++;
    }
  }

  console.log(`✅ Deduplikácia dokončená. Zlúčených ${mergedCount} entít.`);
}

deduplicate();
