import { createClient } from "@supabase/supabase-js";
import { AlertTriangle, ShieldAlert, ArrowLeft, Calendar, FileText, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import RpvsBadge from "../components/RpvsBadge";

// Helper function
function formatEur(amount: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount);
}

export const revalidate = 0; // Vždy fetchnúť čerstvé dáta

export default async function AlertsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Získať všetky transakcie nad 100k a tie, ktoré majú suspicious = true
  const { data: alerts } = await supabase
    .from('transactions')
    .select(`
      *,
      supplier:entities!transactions_supplier_entity_id_fkey(ico, name),
      buyer:entities!transactions_buyer_entity_id_fkey(name)
    `)
    .or('amount_eur.gte.100000,suspicious.eq.true')
    .order('amount_eur', { ascending: false });

  const missingCrz = alerts?.filter(a => a.suspicious) || [];
  const over100k = alerts?.filter(a => a.amount_eur >= 100000) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Zákazky nad 100 000 eur */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 p-6">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Zákazky nad 100 000 € (Kontrola RPVS)
              </h2>
              <p className="text-sm text-amber-700 mt-1">
                Zákazky od subjektov s faktúrou nad 100 000 €. Zákon prikazuje týmto firmám zápis v Registri partnerov verejného sektora.
              </p>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
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
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-4 h-4" />
                      {alert.date_published ? new Date(alert.date_published).toLocaleDateString('sk-SK') : "Neznámy dátum"}
                    </div>
                    <div className="flex gap-2">
                       {alert.supplier?.ico && <RpvsBadge ico={alert.supplier.ico} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Faktúry bez zmluvy v CRZ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 p-6">
              <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Faktúry bez nájdenej zmluvy v CRZ
              </h2>
              <p className="text-sm text-red-700 mt-1">
                Transakcie (faktúry z webu), pri ktorých Krtko nenašiel v CRZ žiadnu zmluvu od danej firmy. 
              </p>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {missingCrz.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
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
                    <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full text-sm">
                      {formatEur(alert.amount_eur)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">Objednávateľ:</span>
                    <span className="text-sm font-medium">{alert.buyer?.name}</span>
                  </div>

                  <div className="text-sm text-slate-700 mb-4 line-clamp-2">
                    <span className="font-medium text-slate-500 mr-2">Predmet faktúry:</span>
                    {alert.subject || "Neuvedený predmet"}
                  </div>
                  
                  {alert.source_url && (
                    <div className="border-t border-slate-100 pt-3">
                       <a href={alert.source_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Odkaz na PDF faktúru
                       </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
