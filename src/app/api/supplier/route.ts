import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ico = searchParams.get('ico');
    
    if (!ico) {
      return NextResponse.json({ success: false, error: 'Chýba IČO' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the supplier entity
    const { data: supplier, error: supplierError } = await supabase
      .from('entities')
      .select('*')
      .eq('ico', ico)
      .single();

    if (supplierError) throw supplierError;
    if (!supplier) return NextResponse.json({ success: false, error: 'Dodávateľ nenájdený' }, { status: 404 });

    // Get all transactions where they are the supplier
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico)')
      .eq('supplier_entity_id', supplier.id)
      .order('date_published', { ascending: false });

    if (txError) throw txError;

    // Calculate stats
    let totalAmount = 0;
    const yearlyVolume: Record<string, number> = {};

    transactions?.forEach(t => {
      totalAmount += Number(t.amount_eur);
      const year = new Date(t.date_published).getFullYear().toString();
      yearlyVolume[year] = (yearlyVolume[year] || 0) + Number(t.amount_eur);
    });

    // Format for chart
    const chartData = Object.keys(yearlyVolume).sort().map(year => ({
      year,
      value: yearlyVolume[year]
    }));

    return NextResponse.json({
      success: true,
      supplier,
      transactions: transactions || [],
      stats: {
        totalAmount,
        totalCount: transactions?.length || 0,
        chartData
      }
    });
  } catch (error: unknown) {
    console.error("API /supplier Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
