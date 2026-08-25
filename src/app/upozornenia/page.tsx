import { createClient } from "@supabase/supabase-js";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AlertsClient from "./AlertsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Vždy fetchnúť čerstvé dáta

interface Transaction {
  id: string;
  amount_eur?: number;
  subject?: string;
  source_type?: string;
  source_url?: string;
  date_published?: string;
  supplier?: { ico?: string; name?: string };
  buyer?: { name?: string };
  suspicious?: boolean;
}

export default async function AlertsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const allTransactions: Transaction[] = [];
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      // Supabase .select() ticho seká na 1000 riadkov. DB ma >2200 transakcii, preto
      // musime paginovat cez .range() az kym prislusna strana nevrati < PAGE, inak by
      // krizova kontrola (crzSuppliers set, missingCrz, over100k) bezala len z prvych
      // 1000 riadkov -> podhodnotene upozornenia a riziko falosnych "chyba v CRZ" oznaceni.
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            supplier:entities!transactions_supplier_entity_id_fkey(ico, name),
            buyer:entities!transactions_buyer_entity_id_fkey(name)
          `)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) {
          console.error("Supabase Error in AlertsPage:", error);
          break;
        }
        if (!data || data.length === 0) break;
        allTransactions.push(...data);
        if (data.length < PAGE) break;
      }
    } catch (err) {
      console.error("Exception in AlertsPage:", err instanceof Error ? err.message : err);
    }
  }

  // Krížová kontrola
  const crzSuppliers = new Set(
    allTransactions
      .filter((t: Transaction) => t.source_type === 'CRZ_CONTRACT' && t.supplier && t.supplier.ico)
      .map((t: Transaction) => t.supplier!.ico)
  );

  const enrichedTransactions = allTransactions.map((t: Transaction) => {
    let suspicious = false;
    if (t.source_type === 'WEB_INVOICE' && t.supplier && t.supplier.ico) {
      if (!crzSuppliers.has(t.supplier.ico)) {
        suspicious = true;
      }
    }
    return { ...t, suspicious };
  });

  const missingCrz = enrichedTransactions.filter(a => a.suspicious) || [];
  const over100k = enrichedTransactions.filter(a => a.amount_eur >= 100000).sort((a, b) => (b.amount_eur || 0) - (a.amount_eur || 0)) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-slate-800 transition-colors p-2 bg-white rounded-full shadow-sm border border-slate-200" aria-label="Späť na dashboard">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-500" aria-hidden="true" />
                Centrum upozornení (Watchdog)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatická krížová kontrola zmlúv v CRZ, faktúr mesta a Registra partnerov verejného sektora.
              </p>
            </div>
          </div>
        </div>

        <AlertsClient over100k={over100k} missingCrz={missingCrz} />
      </div>
    </div>
  );
}
