import { createClient } from "@supabase/supabase-js";
import { AlertTriangle, ShieldAlert, ArrowLeft, Calendar, FileText, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import RpvsBadge from "../components/RpvsBadge";
import AlertsLayout from "./AlertsLayout";

// Helper function
function formatEur(amount: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount);
}

export const revalidate = 0; // Vždy fetchnúť čerstvé dáta

export default async function AlertsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Získať všetky transakcie (pre krížovú kontrolu potrebujeme aj zmluvy aj faktúry)
  const { data: allTransactions, error } = await supabase
    .from('transactions')
    .select(`
      *,
      supplier:entities!transactions_supplier_entity_id_fkey(ico, name),
      buyer:entities!transactions_buyer_entity_id_fkey(name)
    `);

  if (error) {
    console.error("Supabase Error:", error);
  }

  // Krížová kontrola
  const crzSuppliers = new Set(
    (allTransactions || [])
      .filter((t: any) => t.source_type === 'CRZ_CONTRACT' && t.supplier)
      .map((t: any) => t.supplier.ico)
  );

  const enrichedTransactions = (allTransactions || []).map((t: any) => {
    let suspicious = false;
    if (t.source_type === 'WEB_INVOICE' && t.supplier) {
      if (!crzSuppliers.has(t.supplier.ico)) {
        suspicious = true;
      }
    }
    return { ...t, suspicious };
  });

  const missingCrz = enrichedTransactions.filter(a => a.suspicious) || [];
  const over100k = enrichedTransactions.filter(a => a.amount_eur >= 100000).sort((a, b) => b.amount_eur - a.amount_eur) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-slate-800 transition-colors p-2 bg-white rounded-full shadow-sm border border-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              Centrum upozornení (Watchdog)
            </h1>
          </div>
        </div>

        <AlertsLayout 
          children1={
            /* Zákazky nad 100 000 eur */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
              <div className="bg-amber-50 border-b border-amber-100 p-6">
                <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Zákazky nad 100 000 € (Kontrola RPVS)
                </h2>
                <p className="text-sm text-amber-700 mt-1">
                  Zákazky od subjektov s faktúrou nad 100 000 €. Zákon prikazuje týmto firmám zápis v Registri partnerov verejného sektora.
                </p>
              </div>
              
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {over100k.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Žiadne zákazky nad 100 000 €.</div>
                ) : over100k.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">IČO: {alert.supplier?.ico}</p>
                      </div>
                      <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full text-sm">
                        {formatEur(alert.amount_eur)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 mb-4 line-clamp-2">
                      <span className="font-medium text-slate-500 mr-2">Predmet:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <RpvsBadge ico={alert.supplier.ico} />
                      
                      <div className="flex items-center gap-4 text-slate-500 text-xs font-medium">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(alert.date_published).toLocaleDateString('sk-SK')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
          children2={
            /* Faktúry bez CRZ */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
              <div className="bg-red-50 border-b border-red-100 p-6">
                <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Faktúry bez zmluvy v CRZ
                </h2>
                <p className="text-sm text-red-700 mt-1">
                  Dodávatelia, ktorí vystavili faktúru zverejnenú na webe, ale systém nenašiel žiadnu zverejnenú zmluvu v Centrálnom registri zmlúv.
                </p>
              </div>
              
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {missingCrz.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
                    Zatiaľ neboli nájdené žiadne nezrovnalosti.
                  </div>
                ) : missingCrz.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">IČO: {alert.supplier?.ico}</p>
                      </div>
                      <span className="font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full text-sm">
                        {formatEur(alert.amount_eur)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-500 block mb-1">Fakturované za:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {alert.source_url && (
                        <div className="border-t border-slate-100 pt-3">
                          <a href={alert.source_url?.startsWith('http') ? alert.source_url : `https://${alert.source_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Odkaz na PDF faktúru
                          </a>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-slate-500 text-xs font-medium ml-auto">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(alert.date_published).toLocaleDateString('sk-SK')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        />

      </div>
    </div>
  );
}
