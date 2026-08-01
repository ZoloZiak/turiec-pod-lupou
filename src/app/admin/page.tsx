"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

export default function AdminPage() {
  const [unmapped, setUnmapped] = useState<any[]>([]);
  const [realEntities, setRealEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);

  // Mappings state: { unmappedId: selectedRealEntityId }
  const [mappings, setMappings] = useState<Record<string, string>>({});

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
      }
    } catch (e) {
      console.error("Failed to fetch unmapped entities", e);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (sourceId: string) => {
    const targetId = mappings[sourceId];
    if (!targetId) return;

    setMergingId(sourceId);
    try {
      const res = await fetch('/api/admin/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceEntityId: sourceId, targetEntityId: targetId })
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
      alert("Systémová chyba pri spájaní.");
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-4xl mx-auto">
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
            Tento panel zobrazuje entity vytvorené z neštruktúrovaných dát (faktúry z webu),
            ktoré nemajú exaktné IČO. Vyberte reálnu firmu z registra na spárovanie.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : unmapped.length === 0 ? (
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
                    </td>
                    <td className="px-2 py-4 text-center">
                      <ArrowRight className="w-5 h-5 text-slate-300 mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={mappings[entity.id] || ""}
                        onChange={(e) => setMappings({ ...mappings, [entity.id]: e.target.value })}
                      >
                        <option value="">-- Vyberte reálnu firmu --</option>
                        {realEntities.map(re => (
                          <option key={re.id} value={re.id}>
                            {re.name} (IČO: {re.ico})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleMerge(entity.id)}
                        disabled={!mappings[entity.id] || mergingId === entity.id}
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
        )}
      </div>
    </div>
  );
}
