"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, ArrowRight, Search } from "lucide-react";

export default function AdminPage() {
  const [unmapped, setUnmapped] = useState<any[]>([]);
  const [realEntities, setRealEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);
  
  // PDF resolution state
  const [resolvingPdfId, setResolvingPdfId] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState({ ico: "", name: "", amount: "" });

  // Authentication
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Tabs & Logs
  const [activeTab, setActiveTab] = useState<"merge" | "logs" | "pdf">("merge");
  const [logs, setLogs] = useState<any[]>([]);

  // Mappings state: { unmappedId: { ico: string, name: string } }
  const [mappings, setMappings] = useState<Record<string, { ico: string, name: string }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/unmapped');
      const json = await res.json();
      if (json.success) {
        setUnmapped(json.unmapped);
        setRealEntities(json.realEntities);
        
        // Prefill name in mappings so the user doesn't have to retype it
        const initialMappings: Record<string, { ico: string, name: string }> = {};
        json.unmapped.forEach((u: any) => {
          initialMappings[u.id] = { ico: "", name: u.name };
        });
        setMappings(initialMappings);
      }
      
      const logsRes = await fetch('/api/admin/logs');
      const logsJson = await logsRes.json();
      if (logsJson.success) {
        setLogs(logsJson.logs);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "turiec123") {
      setIsAuthenticated(true);
    } else {
      alert("Nesprávne heslo!");
    }
  };

  const handleMerge = async (sourceId: string) => {
    const target = mappings[sourceId];
    if (!target || !target.ico || !target.name) return;

    setMergingId(sourceId);
    try {
      const res = await fetch('/api/admin/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceEntityId: sourceId, targetIco: target.ico, targetName: target.name })
      });
      const json = await res.json();
      if (json.success) {
        // Remove from list
        setUnmapped(prev => prev.filter(e => e.id !== sourceId));
        setMappings(prev => {
          const newMappings = { ...prev };
          delete newMappings[sourceId];
          return newMappings;
        });
      } else {
        alert("Chyba pri spájaní: " + json.error);
      }
    } catch (e) {
      console.error("Merge error:", e);
      alert("Chyba pri spájaní entít.");
    } finally {
      setMergingId(null);
    }
  };

  const handleResolvePdf = async (log: any) => {
    if (!pdfData.ico || !pdfData.amount || !pdfData.name) {
      alert("Vyplňte IČO, Názov a Sumu.");
      return;
    }
    
    setResolvingPdfId(log.id);
    try {
      const res = await fetch('/api/admin/resolve-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId: log.id,
          ico: pdfData.ico,
          name: pdfData.name,
          amount: pdfData.amount,
          url: log.parsed_data?.url
        })
      });
      const json = await res.json();
      if (json.success) {
        setLogs(logs.filter(l => l.id !== log.id));
        setResolvingPdfId(null);
        setPdfData({ ico: "", name: "", amount: "" });
      } else {
        alert("Chyba: " + json.error);
        setResolvingPdfId(null);
      }
    } catch (e) {
      console.error("Resolve error:", e);
      alert("Chyba pri ukladaní PDF faktúry.");
      setResolvingPdfId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      {!isAuthenticated ? (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-2xl font-bold text-center mb-6">Administrácia</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heslo</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Zadajte heslo..."
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700">
              Vstúpiť
            </button>
          </form>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <div className="mb-4">
              <a href="/" className="text-sm font-medium text-blue-600 hover:underline">
                &larr; Späť na Dashboard
              </a>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-8 h-8" />
              Human-in-the-loop Administrácia
            </h1>
            <p className="text-slate-600 mt-2">
              Tento panel zobrazuje entity vytvorené z neštruktúrovaných dát, a audítorské logy o tom, čo scraper našiel a ako to interpretoval.
            </p>
          </header>

          <div className="flex gap-4 border-b border-slate-200 mb-6">
            <button 
              onClick={() => setActiveTab("merge")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "merge" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Spájanie entít (Human-in-the-loop)
            </button>
            <button 
              onClick={() => setActiveTab("pdf")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "pdf" ? "border-amber-600 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Manuálna kontrola PDF
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "logs" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Audítorské Logy
            </button>
          </div>

          {loading && (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && activeTab === "merge" && (
            unmapped.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Všetko je spárované!</h2>
                <p className="text-slate-500 mt-2">Aktuálne neexistujú žiadne nesprárované entity v systéme.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Neoverená Entita (z webu)</th>
                      <th className="px-6 py-4"></th>
                      <th className="px-6 py-4">Priradiť k reálnej firme</th>
                      <th className="px-6 py-4 text-right">Akcia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unmapped.map(entity => (
                      <tr key={entity.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{entity.name}</p>
                          <p className="text-xs text-amber-600 font-mono mt-1">{entity.ico}</p>
                          <a 
                            href={`https://finstat.sk/hladaj?Query=${encodeURIComponent(entity.name)}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs text-blue-600 hover:underline mt-2 flex items-center gap-1"
                          >
                            <Search className="w-3 h-3" /> Hľadať na FinStat
                          </a>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <ArrowRight className="w-5 h-5 text-slate-300 mx-auto" />
                        </td>
                        <td className="px-6 py-4 flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Zadajte skutočné IČO..."
                            className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                            value={mappings[entity.id]?.ico || ""}
                            onChange={(e) => setMappings({
                              ...mappings,
                              [entity.id]: { ...mappings[entity.id], ico: e.target.value }
                            })}
                          />
                          <input
                            type="text"
                            placeholder="Zadajte skutočný názov..."
                            className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                            value={mappings[entity.id]?.name || ""}
                            onChange={(e) => setMappings({
                              ...mappings,
                              [entity.id]: { ...mappings[entity.id], name: e.target.value }
                            })}
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleMerge(entity.id)}
                            disabled={!mappings[entity.id]?.ico || !mappings[entity.id]?.name || mergingId === entity.id}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                          >
                            {mergingId === entity.id ? "Spájam..." : "Potvrdiť zlúčenie"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {!loading && activeTab === "pdf" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-amber-50 border-b border-amber-100 text-amber-800 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Dátum</th>
                    <th className="px-6 py-4">Neznáme PDF (URL)</th>
                    <th className="px-6 py-4">Náhľad vyťaženého textu</th>
                    <th className="px-6 py-4 text-right">Akcia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.filter(log => log.source === 'MANUAL_REVIEW_NEEDED').length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Všetky PDF boli úspešne prečítané. Žiadne nečakajú na kontrolu.</td>
                    </tr>
                  ) : logs.filter(log => log.source === 'MANUAL_REVIEW_NEEDED').map(log => (
                    <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                        {new Date(log.created_at).toLocaleString('sk-SK')}
                      </td>
                      <td className="px-6 py-4">
                        <a href={log.parsed_data?.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium break-all text-xs">
                          {log.parsed_data?.url || "Neznáme URL"}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <pre className="text-xs bg-slate-50 text-slate-600 p-3 rounded-lg overflow-x-auto max-w-sm max-h-32 whitespace-pre-wrap border border-slate-200">
                          {log.parsed_data?.text_preview || log.message}
                        </pre>
                      </td>
                      <td className="px-6 py-4 text-right">
                      {resolvingPdfId === log.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <input 
                            type="text" 
                            placeholder="IČO firmy" 
                            className="w-full text-sm border rounded px-2 py-1"
                            value={pdfData.ico}
                            onChange={(e) => setPdfData({...pdfData, ico: e.target.value})}
                          />
                          <input 
                            type="text" 
                            placeholder="Názov firmy" 
                            className="w-full text-sm border rounded px-2 py-1"
                            value={pdfData.name}
                            onChange={(e) => setPdfData({...pdfData, name: e.target.value})}
                          />
                          <input 
                            type="number" 
                            placeholder="Suma (€)" 
                            className="w-full text-sm border rounded px-2 py-1"
                            value={pdfData.amount}
                            onChange={(e) => setPdfData({...pdfData, amount: e.target.value})}
                          />
                          <div className="flex gap-2 justify-end mt-1">
                            <button 
                              onClick={() => setResolvingPdfId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Zrušiť
                            </button>
                            <button 
                              onClick={() => handleResolvePdf(log)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-medium"
                            >
                              Uložiť faktúru
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResolvingPdfId(log.id);
                            setPdfData({ 
                              ico: log.parsed_data?.extracted_ico || "", 
                              name: "", 
                              amount: log.parsed_data?.extracted_amount || "" 
                            });
                          }}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs"
                        >
                          Skontrolovať manuálne
                        </button>
                      )}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && activeTab === "logs" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Dátum a Čas</th>
                    <th className="px-6 py-4">Zdroj (Scraper)</th>
                    <th className="px-6 py-4">Hlásenie</th>
                    <th className="px-6 py-4">Detail (JSON)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Zatiaľ žiadne logy (tabuľka system_logs je prázdna).</td>
                    </tr>
                  ) : logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                        {new Date(log.created_at).toLocaleString('sk-SK')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {log.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {log.message}
                      </td>
                      <td className="px-6 py-4">
                        <pre className="text-xs bg-slate-800 text-slate-200 p-2 rounded overflow-x-auto max-w-xs">
                          {JSON.stringify(log.parsed_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
