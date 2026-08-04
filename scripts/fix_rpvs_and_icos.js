const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Chýbajú Supabase kľúče!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRpvsStatusRobust(ico, name) {
  const cleanIco = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;

  // Stage 1: Check by ICO via OData API
  if (cleanIco) {
    try {
      const url = 'https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=' + encodeURIComponent(`Ico eq '${cleanIco}'`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const isActive = data.value?.some(record => {
          if (!record.PlatnostDo) return true;
          return new Date(record.PlatnostDo) > new Date();
        });
        if (isActive) {
          return { ico: cleanIco, resolvedIco: cleanIco, active: true };
        }
      }
    } catch (e) {}
  }

  // Stage 2: Fallback - Search by Name via GetPartners API
  if (name && name.trim().length >= 3) {
    const searchTerms = [
      name.trim(),
      name.replace(/,?\s*(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol\.?\s*s\.?\s*r\.?\s*o\.?|k\.?\s*s\.?)$/i, '').trim(),
      name.replace(/,/g, '').trim()
    ];

    for (const term of searchTerms) {
      if (!term || term.length < 3) continue;
      try {
        const url = 'https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=' + encodeURIComponent(term);
        const res = await fetch(url);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const partner = list.find(p => p.TypOsoby === 'Partner verejného sektora' && p.Ico);
            if (partner) {
              const odataUrl = 'https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=' + encodeURIComponent(`Ico eq '${partner.Ico}'`);
              const odataRes = await fetch(odataUrl);
              if (odataRes.ok) {
                const odataData = await odataRes.json();
                const isActive = odataData.value?.some(record => {
                  if (!record.PlatnostDo) return true;
                  return new Date(record.PlatnostDo) > new Date();
                });
                if (isActive) {
                  return { ico: cleanIco, resolvedIco: partner.Ico, active: true };
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  return { ico: cleanIco, resolvedIco: null, active: false };
}

async function fixIcos() {
  console.log("🚀 Spúšťam automatickú opravu a dopárovanie IČO z RPVS...");

  // 1. Získať všetky subjekty bez IČO alebo s NO_ICO_
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, ico');

  if (error) {
    console.error("Chyba načítania entities:", error);
    return;
  }

  let updatedCount = 0;

  for (const entity of entities || []) {
    const res = await checkRpvsStatusRobust(entity.ico, entity.name);

    if (res.resolvedIco && res.resolvedIco !== entity.ico) {
      console.log(`✨ Dopárované IČO pre "${entity.name}": stare=[${entity.ico}] -> nove=[${res.resolvedIco}]`);

      // Overiť, či nové IČO už neexistuje v databáze
      const { data: existing } = await supabase.from('entities').select('id').eq('ico', res.resolvedIco).single();

      if (existing) {
        // Prelinkovať transakcie na existujúce entity s platným IČO
        await supabase.from('transactions').update({ supplier_entity_id: existing.id }).eq('supplier_entity_id', entity.id);
        await supabase.from('transactions').update({ buyer_entity_id: existing.id }).eq('buyer_entity_id', entity.id);
        await supabase.from('entities').delete().eq('id', entity.id);
      } else {
        await supabase.from('entities').update({ ico: res.resolvedIco }).eq('id', entity.id);
      }

      updatedCount++;
    }
  }

  console.log(`🎉 Dokončené! Aktualizovaných/prelinkovaných IČO z RPVS: ${updatedCount}`);
}

fixIcos();
