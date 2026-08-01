import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterIco = searchParams.get('ico');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Načítať všetky mestské organizácie (Entities)
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('*')
      .neq('ico', '99999999') // Ignorovať staré chybné dáta, ak by zostali
      .not('ico', 'like', 'NO_ICO_%');

    if (entitiesError) throw entitiesError;

    // Načítať transakcie so spojenými entitami (Kto kupoval, kto dodával)
    let query = supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)')
      .order('date_published', { ascending: false });

    const { data: transactions, error: txError } = await query;
    if (txError) throw txError;

    // Ak bol zadaný IČO filter pre konkrétnu organizáciu
    let filteredTransactions = transactions || [];
    if (filterIco) {
      filteredTransactions = filteredTransactions.filter(
        (t: any) => t.buyer?.ico === filterIco || t.supplier?.ico === filterIco
      );
    }

    // Agregácie (Štatistiky)
    const totalSpent = filteredTransactions.reduce((acc, curr) => acc + (Number(curr.amount_eur) || 0), 0);
    
    // Top dodávatelia (Sumár výdavkov podľa dodávateľa)
    const supplierAgg = filteredTransactions.reduce((acc: any, curr: any) => {
      if (!curr.supplier) return acc;
      const supplierName = curr.supplier.name;
      if (!acc[supplierName]) {
        acc[supplierName] = 0;
      }
      acc[supplierName] += Number(curr.amount_eur) || 0;
      return acc;
    }, {});

    const topSuppliers = Object.keys(supplierAgg)
      .map(name => ({ name, value: supplierAgg[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      stats: {
        totalSpent,
        totalContracts: filteredTransactions.length,
        entitiesCount: entities?.length || 0,
      },
      topSuppliers,
      transactions: filteredTransactions,
      entities: entities || [],
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
