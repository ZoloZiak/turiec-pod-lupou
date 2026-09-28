import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { INCOME_TX_IDS } from '@/lib/income-ids';
import { isDuplicatePublication } from '@/lib/duplicate-ids';
import { correctIco } from '@/lib/entity-ico-fixes';
import { computeAmendmentSupersessions } from '@/lib/contract-amendments';
import rpvsData from '@/data/rpvs-status.json';
import invoiceStats from '@/data/invoice-stats.json';

export const dynamic = 'force-dynamic';

// Precomputed RPVS stav (skript scripts/build_rpvs_status.js). Mapa IČO -> stav zápisu
// v Registri partnerov verejného sektora: 'registered' | 'not_registered' | 'exempt' | 'unknown'.
// Používame ho na deterministický audit "zákazky nad 100k bez RPVS" — živý fetch z registra
// bol pri záťaži nespoľahlivý (timeouty), precompute je stabilný a okamžitý.
const RPVS_STATUS = (rpvsData as { status: Record<string, string> }).status || {};

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
  direction?: string | null;
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

    // Detekcia stlpca 'direction' (raz na zaciatku requestu). Ak existuje,
    // preferujeme rucne admin rozhodnutia z DB pred statickym INCOME_TX_IDS.
    const { error: dirProbeError } = await supabase
      .from('transactions')
      .select('direction')
      .limit(1);
    const dirMsg = (dirProbeError?.message || '').toLowerCase();
    const hasDirectionColumn = !(
      dirProbeError && dirMsg.includes('column') && dirMsg.includes('direction')
    );

    // Načítať všetky mestské organizácie (Entities)
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('*')
      .eq('type', 'MUNICIPALITY') // Iba mestské podniky a úrad
      .neq('ico', '99999999');

    if (entitiesError) throw entitiesError;

    // Načítať transakcie. ŠKÁLOVANIE: faktúr (WEB_INVOICE) je ~158 000 (celá história CORA
    // mesta Martin od 2010). NEMÁ zmysel ťahať/posielať klientovi všetky — bežné faktúry sú
    // v agregátoch (src/data/invoice-stats.json, precompute). Do zoznamu berieme:
    //   - VŠETKY CRZ zmluvy (potrebné pre agregácie, RPVS, dodatky),
    //   - len RED-FLAG kandidát faktúry (>= INVOICE_LIST_THRESHOLD), z ktorých sa audit počíta,
    //   - pri filterIco (profil dodávateľa) VŠETKY jeho faktúry (malý rozsah pre jednu firmu).
    // Supabase .select() ticho limituje na 1000 riadkov → paginujeme cez .range().
    const INVOICE_LIST_THRESHOLD = 10000;
    const PAGE_SIZE = 1000;
    const selectCols = hasDirectionColumn
      ? 'id, external_id, source_type, amount_eur, subject, date_published, source_url, direction, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)'
      : 'id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)';
    const transactionsData: TransactionRow[] = [];

    // Ak je filterIco (profil dodávateľa/mesta), zisti jeho entity id pre presný filter faktúr.
    let filterEntityId: string | null = null;
    if (filterIco) {
      const { data: ent } = await supabase.from('entities').select('id').eq('ico', filterIco).maybeSingle();
      filterEntityId = (ent?.id as string) || null;
    }

    // Stránkované načítanie jedného zdroja (CRZ / WEB_INVOICE) s voliteľným prahom / entitou.
    async function loadRange(sourceType: string, opts: { minAmount?: number; supplierId?: string | null; buyerId?: string | null } = {}) {
      let from = 0;
      for (;;) {
        let q = supabase.from('transactions').select(selectCols).eq('source_type', sourceType);
        if (opts.minAmount != null) q = q.gte('amount_eur', opts.minAmount);
        if (opts.supplierId && opts.buyerId) q = q.or(`supplier_entity_id.eq.${opts.supplierId},buyer_entity_id.eq.${opts.buyerId}`);
        const { data: pageRows, error: txError } = await q
          .order('date_published', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (txError) throw txError;
        const page = (pageRows || []) as unknown as TransactionRow[];
        for (const row of page) {
          if (row.buyer) row.buyer = { ...row.buyer, ico: correctIco(row.buyer.ico) as string };
          if (row.supplier) row.supplier = { ...row.supplier, ico: correctIco(row.supplier.ico) as string };
        }
        transactionsData.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }

    // 1) Všetky CRZ zmluvy (filtrované podľa entity, ak je filterIco)
    await loadRange('CRZ_CONTRACT', filterEntityId ? { supplierId: filterEntityId, buyerId: filterEntityId } : {});
    // 2) Faktúry: pri profile všetky jeho, inak len red-flag kandidáti (>= prah)
    if (filterEntityId) {
      await loadRange('WEB_INVOICE', { supplierId: filterEntityId, buyerId: filterEntityId });
    } else {
      await loadRange('WEB_INVOICE', { minAmount: INVOICE_LIST_THRESHOLD });
    }
    // Vylúč nekanonické (opakované) zverejnenia tej istej CRZ zmluvy. NFP/dotačné zmluvy
    // zverejňujú v CRZ obe strany (+ re-scrape) → tá istá zmluva má 2–3 CRZ ID; bez tohto
    // by sa ten istý príspevok počítal viackrát a nafukoval hero (viď src/lib/duplicate-ids.ts).
    const transactions = transactionsData.filter(
      (t) => !isDuplicatePublication(t.external_id)
    );

    // Kumulatívne dodatky: CRZ zverejňuje každý dodatok samostatne a do sumy dáva NOVÚ
    // CELKOVÚ cenu diela → bez korekcie sa tá istá zmluva ráta viackrát (~26 M €, ~14 %).
    // Označíme superseded (staršie prepisy tej istej ceny) a rátame len kanonický záznam.
    // Počítame na celom (deduplikovanom) sete, nezávisle od filterIco, aby zoskupenie
    // zmluvných línií bolo konzistentné (viď src/lib/contract-amendments.ts).
    const { supersededIds } = computeAmendmentSupersessions(
      transactions.map((t) => ({
        id: t.id,
        subject: t.subject,
        amount_eur: t.amount_eur,
        supplier: t.supplier ? { ico: t.supplier.ico } : null,
      }))
    );

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

    // Predpočet už nie je potrebný pre kumulatívny prah — audit používa jednotlivú sumu.
    // (ponechané prázdne miesto zámerne; pozri enrichment nižšie)

    // Interné / verejné subjekty, ktoré NIE sú "dodávateľ bez zmluvy" v pravom zmysle:
    // samotné mesto (vnútorný transfer), mestské podniky a monopolní správcovia sietí.
    // Ich faktúra bez CRZ zmluvy nie je red flag (rámcové/zákonné vzťahy).
    const INTERNAL_SUPPLIER = /mesto martin|dopravný podnik|brantner|stefe|turvod|vodárensk|slovak telekom|slovenská pošta|slovenský plynárensk|stredoslovenská|východoslovenská|západoslovenská|orange slovensk|o2 slovakia/i;

    const enrichedTransactions = filteredTransactions.map((t) => {
      // Preferuj DB stlpec direction (rucne admin rozhodnutia) pred INCOME_TX_IDS.
      const is_income = hasDirectionColumn && t.direction
        ? t.direction === 'INCOME'
        : INCOME_TX_IDS.has(t.id);
      let suspicious = false;
      // Príjmy (NFP/dotácie od štátu) nikdy neoznačujeme červenou vlajkou —
      // druhá strana je ministerstvo/agentúra, nie dodávateľ mesta.
      if (!is_income && t.source_type === 'WEB_INVOICE' && t.supplier) {
        // RED FLAG: jednotlivá faktúra ≥ 10 000 € od dodávateľa, ktorý NEMÁ žiadnu zmluvu v CRZ.
        // Prah je data-driven (kalibrované na reálnych dátach): nižšie hodnoty vytvárali šum
        // z bežných priebežných nákupov (servis áut, drobné dodávky), ktoré zmluvu zo zákona
        // mať nemusia. Jedna platba nad 10k € bez zverejnenej zmluvy je konkrétny otáznik.
        // Interné subjekty a monopolných správcov sietí (energie, telco) vylučujeme.
        const amt = Number(t.amount_eur) || 0;
        if (amt >= 10000 && !crzSuppliers.has(t.supplier.ico) && !INTERNAL_SUPPLIER.test(t.supplier.name)) {
          suspicious = true;
        }
      }
      const superseded = supersededIds.has(t.id);
      // Efektívna suma: superseded (starší prepis ceny dodatku) sa neráta do súčtov.
      const effective_amount_eur = superseded ? 0 : (Number(t.amount_eur) || 0);
      // RPVS stav dodávateľa (precomputed). Pri zákazke nad 100k je 'not_registered' červená
      // vlajka (dodávateľ mimo Registra partnerov verejného sektora, bez zákonnej výnimky).
      const rpvs_status = t.supplier ? (RPVS_STATUS[t.supplier.ico] || null) : null;
      return { ...t, suspicious, is_income, superseded, effective_amount_eur, rpvs_status };
    });

    // Výdavky = všetko okrem príjmov (NFP/dotácie mestu). Príjmy sčítame zvlášť.
    // Sumy rátame z effective_amount_eur (superseded dodatky = 0, viď contract-amendments).
    //
    // DÔLEŽITÉ — žiadne dvojité počítanie: hlavné peňažné súčty (totalSpent, top dodávatelia)
    // rátame LEN z CRZ zmlúv. Faktúry (WEB_INVOICE) sú platby ČASTO V RÁMCI existujúcej zmluvy;
    // sčítať zmluvy + faktúry by nafúklo objem (tá istá data-pasca ako kumulatívne dodatky).
    // Faktúry sú samostatná transparentná vrstva (zobrazené v zozname, cross-check na chýbajúcu
    // zmluvu), nie sčítavajú sa do "objemu zmlúv".
    const expenseTx = enrichedTransactions.filter((t) => !t.is_income);
    const incomeTx = enrichedTransactions.filter((t) => t.is_income);
    const contractExpenseTx = expenseTx.filter((t) => t.source_type === 'CRZ_CONTRACT');
    const invoiceTx = expenseTx.filter((t) => t.source_type === 'WEB_INVOICE');
    const totalSpent = contractExpenseTx.reduce((acc, curr) => acc + curr.effective_amount_eur, 0);
    const totalIncome = incomeTx.reduce((acc, curr) => acc + curr.effective_amount_eur, 0);
    // Faktúry: súčet a počet z PRECOMPUTE (invoice-stats.json) — v API máme načítané len
    // red-flag faktúry (>= prah), nie všetkých ~158k. Pri profile dodávateľa (filterIco) rátame
    // z reálne načítaných jeho faktúr (presné pre danú firmu).
    const totalInvoiced = filterIco
      ? invoiceTx.reduce((acc, curr) => acc + curr.effective_amount_eur, 0)
      : (invoiceStats.totalInvoiced || 0);
    const invoiceCountTotal = filterIco ? invoiceTx.length : (invoiceStats.invoiceCount || 0);

    // Top dodávatelia (Sumár výdavkov podľa dodávateľa) — len CRZ zmluvy, bez príjmov aj faktúr.
    const supplierAgg = contractExpenseTx.reduce((acc: Record<string, number>, curr) => {
      if (!curr.supplier) return acc;
      const supplierName = curr.supplier.name;
      if (!acc[supplierName]) {
        acc[supplierName] = 0;
      }
      acc[supplierName] += curr.effective_amount_eur;
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
        totalInvoiced,
        totalContracts: contractExpenseTx.length,
        invoiceCount: invoiceCountTotal,
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
