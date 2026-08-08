import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { CheckCircle, Clock, XCircle, FileText, ArrowLeft, Lightbulb, ExternalLink } from "lucide-react";

export const revalidate = 0;

interface TxRow {
  id: string;
  subject?: string;
  amount_eur?: number;
  source_url?: string;
  source_type?: string;
}

interface PromiseItem {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  politician_name?: string;
  source_url?: string;
  related_transaction_ids?: string[];
}

function formatEur(amount: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default async function SlubomerPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Server Component môže bezpečne použiť Service Role Key na obídenie RLS, inak fallbackne na anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 1. Získať všetky sľuby z databázy
  const { data: promises, error } = await supabase
    .from('promises')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Chyba pri ťahaní sľubov:", error);
  }
  
  // 2. Získať všetky súvisiace zmluvy/faktúry
  const transactionIds = (promises || []).flatMap(p => p.related_transaction_ids || []);
  let txMap = new Map();
  
  if (transactionIds.length > 0) {
    const { data: relatedTransactions } = await supabase
      .from('transactions')
      .select('id, subject, amount_eur, source_url, source_type')
      .in('id', transactionIds);
      
    txMap = new Map((relatedTransactions || []).map(t => [t.id, t]));
  }

  const getStatusUI = (status: string | undefined) => {
    switch(status) {
      case 'SPLNENÉ': return { icon: <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'V RIEŠENÍ': return { icon: <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'ZABUDNUTÉ': return { icon: <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />, bg: 'bg-red-50 text-red-700 border-red-200' };
      default: return { icon: null, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-slate-500 hover:text-slate-800 transition-colors p-2 bg-white rounded-full shadow-sm border border-slate-200" aria-label="Späť na dashboard">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-400" aria-hidden="true" />
            Sľubomer (Predvolebné sľuby)
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-blue-900">Sledujeme plnenie sľubov</h2>
              <p className="text-sm text-blue-700 mt-1">
                Databáza predvolebných sľubov primátora a poslancov. Ku každému sľubu sa snažíme priradiť reálnu zmluvu alebo faktúru, aby sme videli, či sa na ňom skutočne pracuje a koľko nás to reálne stojí.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                <strong>Upozornenie:</strong> Stav plnenia sľubov zatiaľ nie je doložený konkrétnymi dokumentmi (uznesenie MsZ, VZN, zmluva v CRZ). Kým prebieha overovanie, sľuby uvádzame neutrálne a nehodnotíme ich ako splnené či nesplnené.
              </p>

            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {!promises || promises.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Zatiaľ neboli do databázy vložené žiadne sľuby. (Alebo si ešte nespustil migráciu v databáze).</div>
            ) : promises.map((promise: PromiseItem) => {
              const statusUI = getStatusUI(promise.status);
              const txs = (promise.related_transaction_ids || []).map((id: string) => txMap.get(id)).filter(Boolean);

              return (
                <div key={promise.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                        Politik: {promise.politician_name}
                      </span>
                      <h3 className="text-xl font-bold text-slate-800">{promise.title}</h3>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${statusUI.bg}`}>
                      {statusUI.icon}
                      {promise.status}
                    </div>
                  </div>
                  
                  <p className="text-slate-600 mb-4">{promise.description}</p>
                  
                  {promise.source_url && (
                    <a href={promise.source_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-4 w-fit">
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      Zdroj sľubu (Volebný program)
                    </a>
                  )}

                  {/* Prepojené zmluvy */}
                  {txs.length > 0 && (
                    <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                        <FileText className="w-4 h-4" aria-hidden="true" /> Dôkazy z CRZ / Faktúr
                      </h4>
                      <div className="space-y-2">
                        {txs.map((tx: TxRow) => (
                          <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                            <span className="text-sm font-medium text-slate-700 line-clamp-1 flex-1" title={tx.subject}>
                              {tx.subject}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 whitespace-nowrap bg-slate-100 px-2 py-1 rounded">
                                {formatEur(tx.amount_eur)}
                              </span>
                              <a href={tx.source_url?.startsWith('http') ? tx.source_url : `https://${tx.source_url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" aria-label="Otvoriť zdrojový dokument">
                                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
