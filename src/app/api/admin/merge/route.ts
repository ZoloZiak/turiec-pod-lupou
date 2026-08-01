import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { sourceEntityId, targetIco, targetName } = await request.json();

    if (!sourceEntityId || !targetIco || !targetName) {
      return NextResponse.json({ success: false, error: 'Chýba sourceEntityId, targetIco alebo targetName' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Vytvoriť alebo nájsť reálnu entitu s daným IČO
    const { data: realEntity, error: upsertError } = await supabase
      .from('entities')
      .upsert({ 
        ico: targetIco, 
        name: targetName, 
        type: 'COMPANY', 
        normalized_name: targetName.toLowerCase() 
      }, { onConflict: 'ico' })
      .select('id')
      .single();

    if (upsertError || !realEntity) {
      throw upsertError || new Error("Nepodarilo sa vytvoriť reálnu entitu");
    }

    const targetEntityId = realEntity.id;

    // 2. Presunúť všetky transakcie (faktúry/zmluvy), kde bol zdrojový (fake) entity dodávateľ
    const { error: updateSupplierError } = await supabase
      .from('transactions')
      .update({ supplier_entity_id: targetEntityId })
      .eq('supplier_entity_id', sourceEntityId);

    if (updateSupplierError) throw updateSupplierError;

    // 3. Presunúť transakcie, kde bol zdroj kupujúci (menej pravdepodobné, ale pre istotu)
    const { error: updateBuyerError } = await supabase
      .from('transactions')
      .update({ buyer_entity_id: targetEntityId })
      .eq('buyer_entity_id', sourceEntityId);

    if (updateBuyerError) throw updateBuyerError;

    // 4. Zmazať starú (fake) entitu
    const { error: deleteError } = await supabase
      .from('entities')
      .delete()
      .eq('id', sourceEntityId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Merge API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
