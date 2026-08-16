import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { logId, ico, amount, name, url } = body;

    if (!logId || !ico || !amount || !name || !url) {
      return NextResponse.json({ success: false, error: 'Chýbajúce dáta' }, { status: 400 });
    }

    const amountEur = parseFloat(amount);
    if (isNaN(amountEur)) {
      return NextResponse.json({ success: false, error: 'Neplatná suma' }, { status: 400 });
    }

    // 1. Get or create Supplier
    const { data: supplier, error: supplierError } = await supabase.from('entities')
      .upsert({ 
        ico: ico, 
        name: name, 
        type: 'COMPANY', 
        normalized_name: name.toLowerCase() 
      }, { onConflict: 'ico' })
      .select('id')
      .single();

    if (supplierError) throw supplierError;

    // 2. Get Buyer (Mesto Martin)
    const { data: buyer } = await supabase.from('entities')
      .select('id')
      .eq('ico', '00316792')
      .single();

    if (!buyer) {
       return NextResponse.json({ success: false, error: 'Nenašlo sa Mesto Martin v databáze' }, { status: 400 });
    }

    // 3. Create Transaction
    const { error: txError } = await supabase.from('transactions').upsert({
      external_id: `MANUAL_PDF_${Date.now()}_${ico}`,
      source_type: 'WEB_INVOICE',
      source_url: url,
      buyer_entity_id: buyer.id,
      supplier_entity_id: supplier.id,
      amount_eur: amountEur,
      date_published: new Date().toISOString(),
      subject: 'Faktúra vyťažená z PDF (Manuálna kontrola)'
    }, { onConflict: 'external_id' });

    if (txError) throw txError;

    // 4. Delete the log entry
    const { error: logError } = await supabase.from('system_logs').delete().eq('id', logId);
    if (logError) throw logError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Resolve PDF Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
