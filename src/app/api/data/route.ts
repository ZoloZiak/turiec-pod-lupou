import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { INCOME_TX_IDS } from '@/lib/income-ids';

export const dynamic = 'force-dynamic';

interface EntityRef {
  name: string;
  ico: string;
}

interface TransactionRow {
  id: string;
  external_id: string;
  source_type: string;
  amount_eur: number | string;
  subject: string;
  date_published: string;
  source_url: string;
  buyer: EntityRef | null;
  supplier: EntityRef | null;
}

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
      .eq('type', 'MUNICIPALITY') // Iba mestské podniky a úrad
      .neq('ico', '99999999');

    if (entitiesError) throw entitiesError;

    // Načítať transakcie so spojenými entitami (Kto kupoval, kto dodával)
    const query = supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)')
      .order('date_published', { ascending: false });

    const { data: transactionsData, error: txError } = await query;
    if (txError) throw txError;
    const transactions = (transactionsData || []) as unknown as TransactionRow[];

    // Ak bol zadaný IČO filter pre konkrétnu organizáciu
    let filteredTransactions: TransactionRow[] = transactions;
    if (filterIco) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.buyer?.ico === filterIco || t.supplier?.ico === filterIco
      );
    }

    // Agregácie (Štatistiky) a Krížová kontrola (Cross-check)
    const crzSuppliers = new Set(
      transactions
        .filter((t) => t.source_type === 'CRZ_CONTRACT' && t.supplier)
        .map((t) => t.supplier!.ico)
    );

    const enrichedTransactions = filteredTransactions.map((t) => {
      const is_income = INCOME_TX_IDS.has(t.id);
      let suspicious = false;
      // Príjmy (NFP/dotácie od štátu) nikdy neoznačujeme červenou vlajkou —
      // druhá strana je ministerstvo/agentúra, nie dodávateľ mesta.
      if (!is_income && t.source_type === 'WEB_INVOICE' && t.supplier) {
        // Skontrolujeme, či dodávateľ má vôbec nejakú zmluvu v CRZ
        if (!crzSuppliers.has(t.supplier.ico)) {
          suspicious = true;
        }
      }
      return { ...t, suspicious, is_income };
    });

    // Výdavky = všetko okrem príjmov (NFP/dotácie mestu). Príjmy sčítame zvlášť.
    const expenseTx = enrichedTransactions.filter((t) => !t.is_income);
    const incomeTx = enrichedTransactions.filter((t) => t.is_income);
    const totalSpent = expenseTx.reduce((acc, curr) => acc + (Number(curr.amount_eur) || 0), 0);
    const totalIncome = incomeTx.reduce((acc, curr) => acc + (Number(curr.amount_eur) || 0), 0);

    // Top dodávatelia (Sumár výdavkov podľa dodávateľa) — bez príjmov (tam je "dodávateľ" štát).
    const supplierAgg = expenseTx.reduce((acc: Record<string, number>, curr) => {
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
        totalIncome,
        totalContracts: expenseTx.length,
        incomeCount: incomeTx.length,
        entitiesCount: entities?.length || 0,
      },
      topSuppliers,
      transactions: enrichedTransactions,
      entities: entities || [],
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
