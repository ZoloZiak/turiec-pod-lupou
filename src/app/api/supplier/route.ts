import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isDuplicatePublication } from '@/lib/duplicate-ids';
import { correctIco, wrongIcosFor } from '@/lib/entity-ico-fixes';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawIco = searchParams.get('ico');

    if (!rawIco) {
      return NextResponse.json({ success: false, error: 'Chýba IČO' }, { status: 400 });
    }
    // Ak sa dostane žiadosť na známy chybný IČO (napr. starý odkaz / orphan, ktorý Krtko
    // znova založil pred nočným merge), presmerujeme na reálne IČO (viď entity-ico-fixes.ts).
    const ico = correctIco(rawIco) as string;

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

    // Trieda ekvivalencie entít: kanonická entita (správne IČO) + prípadné ORPHAN entity,
    // ktoré Krtko cez noc znova založí s chybným IČO (napr. Nolčovo 00216822 → 00316822).
    // Transakcie priviazané na orphan by inak na profile chýbali, kým DB merge whack-a-mole
    // nedobehne. Zozbierame ID všetkých entít v triede a agregujeme naprieč nimi.
    const wrongIcos = wrongIcosFor(ico);
    const entityIds: string[] = [supplier.id];
    if (wrongIcos.length > 0) {
      const { data: orphans, error: orphanErr } = await supabase
        .from('entities')
        .select('id')
        .in('ico', wrongIcos);
      if (orphanErr) throw orphanErr;
      for (const o of orphans || []) if (!entityIds.includes(o.id)) entityIds.push(o.id);
    }

    // Get all transactions where they are the supplier.
    // Supabase ticho seka .select() na default limit 1000 -> pri dodavatelovi s >1000
    // zmluvami by boli totalAmount aj totalCount PODHODNOTENE. Paginujeme cez .range()
    // (rovnaka oprava ako /api/data hero, T01). Pod 1000 zmluv = jeden request, spravanie
    // nezmenene; nad 1000 dobehne spravny sucet.
    const PAGE = 1000;
    interface TxRow {
      id: string;
      external_id: string | null;
      source_type: string | null;
      amount_eur: number | null;
      subject: string | null;
      date_published: string;
      source_url: string | null;
      buyer: unknown;
    }
    const transactions: TxRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: txError } = await supabase
        .from('transactions')
        .select('id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico)')
        .in('supplier_entity_id', entityIds)
        .order('date_published', { ascending: false })
        .range(from, from + PAGE - 1);

      if (txError) throw txError;
      if (!page || page.length === 0) break;
      transactions.push(...(page as unknown as TxRow[]));
      if (page.length < PAGE) break;
    }

    // Vylúč nekanonické (opakované) zverejnenia tej istej CRZ zmluvy (NFP zverejnené oboma
    // stranami + re-scrape) — inak by profil dodávateľa (napr. MIRRI) mal nafúknutý súčet.
    const dedupTransactions = transactions.filter(
      (t) => !isDuplicatePublication(t.external_id)
    );

    // Calculate stats
    let totalAmount = 0;
    const yearlyVolume: Record<string, number> = {};

    dedupTransactions?.forEach(t => {
      const amount = Number(t.amount_eur) || 0;
      totalAmount += amount;
      const year = new Date(t.date_published).getFullYear().toString();
      yearlyVolume[year] = (yearlyVolume[year] || 0) + amount;
    });

    // Format for chart
    const chartData = Object.keys(yearlyVolume).sort().map(year => ({
      year,
      value: yearlyVolume[year]
    }));

    return NextResponse.json({
      success: true,
      supplier,
      transactions: dedupTransactions || [],
      stats: {
        totalAmount,
        totalCount: dedupTransactions?.length || 0,
        chartData
      }
    });
  } catch (error: unknown) {
    console.error("API /supplier Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
