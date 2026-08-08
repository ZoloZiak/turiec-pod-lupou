import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all entities
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('id, ico, name')
      .order('name', { ascending: true });

    if (entitiesError) throw entitiesError;

    // Fetch PDF transactions (invoices) for double check
    const { data: pdfs, error: pdfsError } = await supabase
      .from('transactions')
      .select('id, amount_eur, transaction_date, description, source_url, supplier:supplier_entity_id(name, ico), client:client_entity_id(name, ico)')
      .eq('source_type', 'WEB_INVOICE')
      .order('transaction_date', { ascending: false });

    if (pdfsError) throw pdfsError;

    return NextResponse.json({
      success: true,
      entities: entities || [],
      pdfs: pdfs || [],
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
