"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, AlertTriangle, ArrowRight, Search, Plus, Trash2, Edit2, Check, FileText } from "lucide-react";
import Link from "next/link";

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

  // Admin API auth: heslo == ADMIN_PASSWORD (server-side v /api/admin/*).
  // Posiela sa ako Bearer pri KAZDOM admin volani. Heslo drzime len v pamati
  // (state), nikdy nie v bundli/localStorage.
  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      Authorization: `Bearer ${password}`,
      ...(extra || {}),
    }),
    [password]
  );

  // Tabs & Logs
  const [activeTab, setActiveTab] = useState<"merge" | "logs" | "pdf_logs" | "pdfs" | "entities" | "promises" | "direction">("merge");
  const [logs, setLogs] = useState<any[]>([]);

  // Smer transakcii (human-in-the-loop review)
  const [directionItems, setDirectionItems] = useState<any[]>([]);
  const [directionNeedsMigration, setDirectionNeedsMigration] = useState(false);
  const [directionLoading, setDirectionLoading] = useState(false);
  const [savingDirectionId, setSavingDirectionId] = useState<string | null>(null);
  
  // Dashboard state
  const [promises, setPromises] = useState<any[]>([]);
  const [allEntities, setAllEntities] = useState<any[]>([]);
  const [webPdfs, setWebPdfs] = useState<any[]>([]);

  // Mappings state: { unmappedId: { ico: string, name: string } }
  const [mappings, setMappings] = useState<Record<string, { ico: string, name: string }>>({});

  // Slubomer editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/unmapped', { headers: authHeaders() });
      if (res.status === 401) { setIsAuthenticated(false); alert("Neplatné heslo (401)."); return; }
      const json = await res.json();
      if (json.success) {
        setUnmapped(json.unmapped);
        setRealEntities(json.realEntities);
        
        const initialMappings: Record<string, { ico: string, name: string }> = {};
        json.unmapped.forEach((u: { id: string; name: string }) => {
          initialMappings[u.id] = { ico: "", name: u.name };
        });
        setMappings(initialMappings);
      }
      
      const logsRes = await fetch('/api/admin/logs', { headers: authHeaders() });
      const logsJson = await logsRes.json();
      if (logsJson.success) {
        setLogs(logsJson.logs);
      }

      const dashRes = await fetch('/api/admin/dashboard', { headers: authHeaders() });
      const dashJson = await dashRes.json();
      if (dashJson.success) {
        setAllEntities(dashJson.entities);
        setWebPdfs(dashJson.pdfs);
      }

      const promRes = await fetch('/api/admin/promises', { headers: authHeaders() });
      const promJson = await promRes.json();
      if (promJson.success) {
        setPromises(promJson.promises);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  const fetchDirection = useCallback(async () => {
    setDirectionLoading(true);
    try {
      const res = await fetch('/api/admin/direction?filter=unsure', { headers: authHeaders() });
      const json = await res.json();
      if (json.needsMigration) {
        setDirectionNeedsMigration(true);
        setDirectionItems([]);
      } else if (json.success) {
        setDirectionNeedsMigration(false);
        setDirectionItems(json.items || []);
      }
    } catch (e) {
      console.error("Failed to fetch direction data", e);
    } finally {
      setDirectionLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (isAuthenticated && activeTab === "direction") {
      fetchDirection();
    }
  }, [isAuthenticated, activeTab, fetchDirection]);

  const handleSetDirection = async (id: string, direction: "INCOME" | "EXPENSE") => {
    setSavingDirectionId(id);
    try {
      const res = await fetch('/api/admin/direction', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, direction })
      });
      const json = await res.json();
      if (json.needsMigration) {
        setDirectionNeedsMigration(true);
      } else if (json.success) {
        setDirectionItems(prev => prev.map(it => it.id === id ? { ...it, current_direction: direction, done: true } : it));
      } else {
        alert("Chyba pri ukladaní smeru: " + json.error);
      }
    } catch (e) {
      console.error("Direction save error:", e);
      alert("Systémová chyba pri ukladaní smeru.");
    } finally {
      setSavingDirectionId(null);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Overenie robi SERVER: heslo sa posle ako Bearer pri prvom fetchi.
    // Ak je nespravne, /api/admin/* vrati 401 a fetchData odhlasi (alert).
    if (password) {
      setIsAuthenticated(true);
    } else {
      alert("Zadajte heslo!");
    }
  };

  const handleMerge = async (sourceId: string) => {
    const target = mappings[sourceId];
    if (!target || !target.ico || !target.name) return;

    setMergingId(sourceId);
    try {
      const res = await fetch('/api/admin/merge', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sourceEntityId: sourceId, targetIco: target.ico, targetName: target.name })
      });
      const json = await res.json();
      if (json.success) {
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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

  // --- Promises Handlers ---
  const handleSavePromise = async (promise: any, isNew: boolean = false) => {
    try {
      const res = await fetch('/api/admin/promises', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: isNew ? 'CREATE' : 'UPDATE',
          promise
        })
      });
      const json = await res.json();
      if (json.success) {
        alert("Sľub úspešne uložený");
        setEditingId(null);
        setIsCreating(false);
        fetchData();
      } else {
        alert("Chyba pri ukladaní: " + json.error);
      }
    } catch (e) {
      alert("Systémová chyba");
    }
  };

  const handleDeletePromise = async (id: string) => {
    if (!confirm("Naozaj chcete vymazať tento sľub?")) return;
    try {
      const res = await fetch('/api/admin/promises', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'DELETE',
          promise: { id }
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (e) {
      alert("Systémová chyba");
    }
  };

  const startEditPromise = (p: any) => {
    setEditingId(p.id);
    setEditForm({ ...p });
    setIsCreating(false);
  };

  const startCreatePromise = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      title: "",
      description: "",
      politician_name: "Ján Danko",
      status: "V RIEŠENÍ",
      source_url: "",
      related_transaction_ids: []
    });
  };

  return (
    <div className="min-h-screen bg-surface text-body font-sans p-8">
      {!isAuthenticated ? (
        <div className="max-w-md mx-auto mt-20 bg-card p-8 rounded-2xl shadow-sm border border-line">
          <h2 className="text-2xl font-bold text-center mb-6">Administrácia</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-body mb-1">Heslo</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Zadajte heslo..."
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700">
              Vstúpiť
            </button>
          </form>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <div className="mb-4">
              <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
                &larr; Späť na Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-body flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-8 h-8" />
              Riadiace centrum (Krtko)
            </h1>
          </header>

          <div className="flex gap-4 border-b border-line mb-6 flex-wrap">
            <button 
              onClick={() => setActiveTab("merge")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "merge" ? "border-blue-600 text-blue-600" : "border-transparent text-muted hover:text-body"}`}
            >
              Spájanie entít
            </button>
            <button 
              onClick={() => setActiveTab("entities")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "entities" ? "border-indigo-600 text-indigo-600" : "border-transparent text-muted hover:text-body"}`}
            >
              Všetky firmy (Zoznam)
            </button>
            <button 
              onClick={() => setActiveTab("pdfs")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "pdfs" ? "border-emerald-600 text-emerald-600" : "border-transparent text-muted hover:text-body"}`}
            >
              Vyťažené PDF Faktúry
            </button>
            <button 
              onClick={() => setActiveTab("pdf_logs")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "pdf_logs" ? "border-amber-600 text-amber-600" : "border-transparent text-muted hover:text-body"}`}
            >
              Nevyriešené PDF (Logy)
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "logs" ? "border-line text-body" : "border-transparent text-muted hover:text-body"}`}
            >
              Audítorské Logy
            </button>
            <button 
              onClick={() => setActiveTab("direction")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === "direction" ? "border-teal-600 text-teal-600" : "border-transparent text-muted hover:text-body"}`}
            >
              Smer transakcií
            </button>
            <button 
              onClick={() => setActiveTab("promises")}
              className={`pb-3 font-medium text-sm border-b-2 transition-colors ml-auto ${activeTab === "promises" ? "border-amber-500 text-amber-500" : "border-transparent text-amber-600 hover:text-amber-700"}`}
            >
              Sľubomer &rarr;
            </button>
          </div>

          {loading && (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && activeTab === "merge" && (
            unmapped.length === 0 ? (
              <div className="bg-card p-12 rounded-2xl shadow-sm border border-line text-center">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-body">Všetko je spárované!</h2>
                <p className="text-muted mt-2">Aktuálne neexistujú žiadne nesprárované entity v systéme.</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface border-b border-line text-muted uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Neoverená Entita (z webu)</th>
                      <th className="px-6 py-4"></th>
                      <th className="px-6 py-4">Priradiť k reálnej firme</th>
                      <th className="px-6 py-4 text-right">Akcia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {unmapped.map(entity => (
                      <tr key={entity.id} className="hover:bg-surface transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-body">{entity.name}</p>
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
                          <ArrowRight className="w-5 h-5 text-body mx-auto" />
                        </td>
                        <td className="px-6 py-4 flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Zadajte skutočné IČO..."
                            className="w-full bg-card border border-line text-body px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                            value={mappings[entity.id]?.ico || ""}
                            onChange={(e) => setMappings({
                              ...mappings,
                              [entity.id]: { ...mappings[entity.id], ico: e.target.value }
                            })}
                          />
                          <input
                            type="text"
                            placeholder="Zadajte skutočný názov..."
                            className="w-full bg-card border border-line text-body px-3 py-2 rounded focus:outline-none focus:border-blue-500"
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
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-elevated disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
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

          {!loading && activeTab === "entities" && (
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                <h2 className="font-bold text-indigo-900">Všetky firmy a organizácie v databáze</h2>
                <span className="text-xs font-medium text-indigo-700 bg-indigo-200 px-2 py-1 rounded-full">{allEntities.length} záznamov</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface border-b border-line text-muted uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Názov Subjektu</th>
                      <th className="px-6 py-4">IČO</th>
                      <th className="px-6 py-4 text-right">FinStat Odkaz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allEntities.map(entity => (
                      <tr key={entity.id} className="hover:bg-surface">
                        <td className="px-6 py-4 font-medium text-body">{entity.name}</td>
                        <td className="px-6 py-4 font-mono text-muted">{entity.ico}</td>
                        <td className="px-6 py-4 text-right">
                          {entity.ico && !entity.ico.startsWith('NO_ICO_') ? (
                            <a href={`https://finstat.sk/${entity.ico}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1 text-xs font-semibold">
                              Otvoriť <ArrowRight className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted">Nedostupné</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "pdfs" && (
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                <h2 className="font-bold text-emerald-900">PDF faktúry úspešne vyťažené z webu (OCR)</h2>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-200 px-2 py-1 rounded-full">{webPdfs.length} dokladov</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface border-b border-line text-muted uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Dátum</th>
                      <th className="px-6 py-4">Dodávateľ (Vyťažený)</th>
                      <th className="px-6 py-4">Suma</th>
                      <th className="px-6 py-4">Popis / Zmluva</th>
                      <th className="px-6 py-4 text-right">Zdroj (PDF)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {webPdfs.map(pdf => (
                      <tr key={pdf.id} className="hover:bg-surface">
                        <td className="px-6 py-4 whitespace-nowrap text-muted">{new Date(pdf.transaction_date).toLocaleDateString('sk-SK')}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-body">{pdf.supplier?.name}</p>
                          <p className="text-xs text-muted font-mono">{pdf.supplier?.ico}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600 whitespace-nowrap">
                          {pdf.amount_eur.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-6 py-4 text-muted text-xs">
                          {pdf.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a href={pdf.source_url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                            <FileText className="w-3 h-3" /> Zobraziť PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "pdf_logs" && (
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-amber-50 border-b border-amber-100 text-amber-800 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Dátum</th>
                    <th className="px-6 py-4">Neznáme PDF (URL)</th>
                    <th className="px-6 py-4">Náhľad vyťaženého textu</th>
                    <th className="px-6 py-4 text-right">Akcia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.filter(log => log.source === 'MANUAL_REVIEW_NEEDED').length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted">Všetky PDF boli úspešne prečítané. Žiadne nečakajú na kontrolu.</td>
                    </tr>
                  ) : logs.filter(log => log.source === 'MANUAL_REVIEW_NEEDED').map(log => (
                    <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted text-xs">
                        {new Date(log.created_at).toLocaleString('sk-SK')}
                      </td>
                      <td className="px-6 py-4">
                        <a href={log.parsed_data?.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium break-all text-xs">
                          {log.parsed_data?.url || "Neznáme URL"}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <pre className="text-xs bg-surface text-muted p-3 rounded-lg overflow-x-auto max-w-sm max-h-32 whitespace-pre-wrap border border-line">
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
                              className="text-xs text-muted hover:text-body"
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
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface border-b border-line text-muted uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Dátum a Čas</th>
                    <th className="px-6 py-4">Zdroj (Scraper)</th>
                    <th className="px-6 py-4">Hlásenie</th>
                    <th className="px-6 py-4">Detail (JSON)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted">Zatiaľ žiadne logy (tabuľka system_logs je prázdna).</td>
                    </tr>
                  ) : logs.map(log => (
                    <tr key={log.id} className="hover:bg-surface">
                      <td className="px-6 py-4 whitespace-nowrap text-muted text-xs">
                        {new Date(log.created_at).toLocaleString('sk-SK')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-elevated text-body">
                          {log.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-body">
                        {log.message}
                      </td>
                      <td className="px-6 py-4">
                        <pre className="text-xs bg-elevated text-body p-2 rounded overflow-x-auto max-w-xs">
                          {JSON.stringify(log.parsed_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "direction" && (
            <div>
              <div className="mb-4 p-4 bg-teal-50 border border-teal-100 rounded-xl text-sm text-teal-900">
                <p className="font-semibold mb-1">Ručná kontrola smeru transakcií (príjem vs. výdavok)</p>
                <p className="text-teal-800">NFP/dotácia od ministerstva = <strong>Príjem</strong> (peniaze pre mesto). Bežná zmluva/faktúra = <strong>Výdavok</strong>.</p>
              </div>

              {directionLoading && (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              )}

              {!directionLoading && directionNeedsMigration && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-amber-900 mb-1">Chýba stĺpec „direction“ v databáze</h3>
                      <p className="text-amber-800 text-sm mb-2">
                        Perzistencia smeru transakcií zatiaľ nie je aktívna. Spustite jednorazovo SQL skript
                        v Supabase SQL editore (Dashboard &rarr; SQL Editor):
                      </p>
                      <pre className="text-xs bg-amber-100 text-amber-900 p-3 rounded-lg border border-amber-200 overflow-x-auto">database/add_direction_column.sql</pre>
                      <button
                        onClick={fetchDirection}
                        className="mt-3 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                      >
                        Skúsiť znova
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!directionLoading && !directionNeedsMigration && (
                <div className="space-y-4">
                  {directionItems.length === 0 ? (
                    <div className="bg-card p-12 rounded-2xl shadow-sm border border-line text-center">
                      <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                      <h2 className="text-xl font-bold text-body">Žiadne sporné zmluvy na kontrolu.</h2>
                    </div>
                  ) : directionItems.map(item => (
                    <div
                      key={item.id}
                      className={`bg-card p-6 rounded-2xl shadow-sm border transition-colors ${item.done ? 'border-emerald-200 opacity-70' : 'border-line'}`}
                    >
                      <div className="flex justify-between items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2 mb-1">
                            {item.done && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            <h3 className="font-bold text-body">{item.subject}</h3>
                          </div>
                          <p className="text-sm text-muted mb-2">
                            <span className="font-medium">{item.buyer}</span>
                            <span className="text-muted"> &larr; </span>
                            <span className="font-medium">{item.supplier}</span>
                          </p>
                          <p className="text-lg font-bold text-body mb-1">
                            {Number(item.amount_eur).toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <p className="text-xs text-muted mb-2 italic">{item.reason}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`px-2 py-1 rounded-full font-semibold ${item.current_direction === 'INCOME' ? 'bg-emerald-100 text-emerald-800' : 'bg-elevated text-body'}`}>
                              Aktuálne: {item.current_direction === 'INCOME' ? 'Príjem' : 'Výdavok'}
                            </span>
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline inline-flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Zobraziť zmluvu
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <button
                            onClick={() => handleSetDirection(item.id, "INCOME")}
                            disabled={savingDirectionId === item.id}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${item.current_direction === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                          >
                            {savingDirectionId === item.id ? '...' : 'Príjem (dotácia)'}
                          </button>
                          <button
                            onClick={() => handleSetDirection(item.id, "EXPENSE")}
                            disabled={savingDirectionId === item.id}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${item.current_direction === 'EXPENSE' ? 'bg-elevated text-body' : 'bg-surface text-body hover:bg-elevated border border-line'}`}
                          >
                            {savingDirectionId === item.id ? '...' : 'Výdavok'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "promises" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-body">Správa predvolebných sľubov</h2>
                  <p className="text-muted text-sm">Aktualizujte a spravujte sľuby, ktoré sa zobrazujú verejnosti.</p>
                </div>
                <button onClick={startCreatePromise} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm">
                  <Plus className="w-4 h-4" /> Nový Sľub
                </button>
              </div>

              {isCreating && (
                <div className="bg-card p-6 rounded-2xl shadow-sm border border-amber-200 mb-8">
                  <h2 className="text-xl font-bold mb-4 text-amber-900">Pridať nový sľub</h2>
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <input type="text" placeholder="Názov sľubu (napr. Nová plaváreň)" className="border p-2 rounded text-sm" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                    <textarea placeholder="Detailný popis" className="border p-2 rounded text-sm" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                    <div className="flex gap-4">
                      <select className="border p-2 rounded flex-1 text-sm" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                        <option value="SPLNENÉ">SPLNENÉ</option>
                        <option value="V RIEŠENÍ">V RIEŠENÍ</option>
                        <option value="ZABUDNUTÉ">ZABUDNUTÉ</option>
                      </select>
                      <input type="text" placeholder="Politik" className="border p-2 rounded flex-1 text-sm" value={editForm.politician_name} onChange={e => setEditForm({...editForm, politician_name: e.target.value})} />
                    </div>
                    <input type="text" placeholder="Link na zdroj (URL programu)" className="border p-2 rounded text-sm" value={editForm.source_url} onChange={e => setEditForm({...editForm, source_url: e.target.value})} />
                    <input type="text" placeholder="Zmluvy (Zadajte ID zmlúv oddelené čiarkou)" className="border p-2 rounded text-sm" value={(editForm.related_transaction_ids || []).join(',')} onChange={e => {
                      const ids = e.target.value.split(',').map(i => i.trim()).filter(Boolean);
                      setEditForm({...editForm, related_transaction_ids: ids});
                    }} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded-lg hover:bg-surface text-sm">Zrušiť</button>
                    <button onClick={() => handleSavePromise(editForm, true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">Vytvoriť sľub</button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {promises.map(p => (
                  <div key={p.id} className="bg-card p-6 rounded-2xl shadow-sm border border-line">
                    {editingId === p.id ? (
                      <div>
                        <input type="text" className="border p-2 rounded w-full mb-2 font-bold text-sm" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                        <textarea className="border p-2 rounded w-full mb-2 text-sm" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                        <div className="flex gap-4 mb-2">
                          <select className="border p-2 rounded flex-1 text-sm" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                            <option value="SPLNENÉ">SPLNENÉ</option>
                            <option value="V RIEŠENÍ">V RIEŠENÍ</option>
                            <option value="ZABUDNUTÉ">ZABUDNUTÉ</option>
                          </select>
                          <input type="text" className="border p-2 rounded flex-1 text-sm" value={editForm.politician_name} onChange={e => setEditForm({...editForm, politician_name: e.target.value})} />
                        </div>
                        <input type="text" placeholder="Zdroj URL" className="border p-2 rounded w-full mb-2 text-sm" value={editForm.source_url} onChange={e => setEditForm({...editForm, source_url: e.target.value})} />
                        <input type="text" placeholder="Zmluvy (ID oddelené čiarkou)" className="border p-2 rounded w-full mb-4 text-sm" value={(editForm.related_transaction_ids || []).join(',')} onChange={e => {
                          const ids = e.target.value.split(',').map(i => i.trim()).filter(Boolean);
                          setEditForm({...editForm, related_transaction_ids: ids});
                        }} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 border rounded-lg hover:bg-surface text-body text-sm">Zrušiť</button>
                          <button onClick={() => handleSavePromise(editForm, false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1 text-sm font-medium"><Check className="w-4 h-4"/> Uložiť</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${p.status === 'SPLNENÉ' ? 'bg-emerald-100 text-emerald-800' : p.status === 'V RIEŠENÍ' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {p.status}
                            </span>
                            <h3 className="text-xl font-bold">{p.title}</h3>
                          </div>
                          <p className="text-muted text-sm mb-2">{p.description}</p>
                          <div className="text-xs font-mono text-muted">
                            {p.related_transaction_ids && p.related_transaction_ids.length > 0 && (
                              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Prepojených zmlúv: {p.related_transaction_ids.length}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEditPromise(p)} className="p-2 text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-5 h-5"/></button>
                          <button onClick={() => handleDeletePromise(p.id)} className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
