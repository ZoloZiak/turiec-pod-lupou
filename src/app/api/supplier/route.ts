import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isDuplicatePublication } from '@/lib/duplicate-ids';
import { correctIco, wrongIcosFor } from '@/lib/entity-ico-fixes';
import { computeAmendmentSupersessions } from '@/lib/contract-amendments';

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

    // Trieda ekvivalencie entít: kanonická entita (správne IČO) + prípadné ORPHAN entity,
    // ktoré Krtko cez noc znova založí s chybným IČO (napr. Nolčovo 00216822 → 00316822,
    // WATCH #89: BTI "52  222 438" → 47619503 atď.). Transakcie priviazané na orphan by inak
    // na profile chýbali, kým DB merge whack-a-mole nedobehne.
    const wrongIcos = wrongIcosFor(ico);

    // Kanonická entita (správne IČO). maybeSingle() → 0 rows nevyhodí chybu.
    const { data: canonical, error: supplierError } = await supabase
      .from('entities')
      .select('*')
      .eq('ico', ico)
      .maybeSingle();
    if (supplierError) throw supplierError;

    const entityIds: string[] = [];
    let supplier = canonical;
    if (canonical) entityIds.push(canonical.id);

    // Ak Krtko cez noc reálne IČO ešte nezaložil ako kanonickú entitu (existuje len orphan
    // s poškodeným IČO), fallback na orphan entitu z triedy ekvivalencie — inak by profil
    // vrátil 404. IČO na zobrazenie však vždy nahradíme reálnym (opraveným) IČO.
    if (wrongIcos.length > 0) {
      const { data: orphans, error: orphanErr } = await supabase
        .from('entities')
        .select('*')
        .in('ico', wrongIcos);
      if (orphanErr) throw orphanErr;
      for (const o of orphans || []) {
        if (!entityIds.includes(o.id)) entityIds.push(o.id);
        if (!supplier) supplier = { ...o, ico };
      }
    }

    if (!supplier || entityIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Dodávateľ nenájdený' }, { status: 404 });
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

    // Kumulatívne dodatky: CRZ dáva do každého dodatku NOVÚ CELKOVÚ cenu diela → bez korekcie
    // by profil dodávateľa (napr. BM-MONT: 5× dodatok k tej istej stavbe) mal mnohonásobne
    // nafúknutý súčet. Superseded (staršie prepisy) sa nerátajú (viď contract-amendments.ts).
    // Tu sú všetky tx toho istého dodávateľa, preto supplier.ico dodáme jednotne.
    const { supersededIds } = computeAmendmentSupersessions(
      dedupTransactions.map((t) => ({
        id: t.id,
        subject: t.subject,
        amount_eur: t.amount_eur,
        supplier: { ico },
      }))
    );

    // Calculate stats — sumy z efektívnej sumy (superseded dodatky = 0).
    // totalAmount = LEN objem zmlúv (CRZ). Faktúry (WEB_INVOICE) sčítame zvlášť do totalInvoiced,
    // aby sa nezdvojovali (faktúra je platba často v rámci zmluvy). Trend graf = objem zmlúv.
    let totalAmount = 0;
    let totalInvoiced = 0;
    const yearlyVolume: Record<string, number> = {};

    dedupTransactions?.forEach(t => {
      const amount = supersededIds.has(t.id) ? 0 : (Number(t.amount_eur) || 0);
      if (t.source_type === 'WEB_INVOICE') {
        totalInvoiced += amount;
        return;
      }
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
      transactions: (dedupTransactions || []).map((t) => ({
        ...t,
        superseded: supersededIds.has(t.id),
        effective_amount_eur: supersededIds.has(t.id) ? 0 : (Number(t.amount_eur) || 0),
      })),
      stats: {
        totalAmount,
        totalInvoiced,
        totalCount: dedupTransactions?.length || 0,
        chartData
      }
    });
  } catch (error: unknown) {
    console.error("API /supplier Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
