"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, Plus, Trash2, Edit2, Check, X, FileText } from "lucide-react";
import Link from "next/link";

export default function PromisesAdminPage() {
  const [promises, setPromises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Authentication
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchPromises();
  }, []);

  const fetchPromises = async () => {
    try {
      const res = await fetch('/api/admin/promises');
      const json = await res.json();
      if (json.success) {
        setPromises(json.promises);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "Krtko2024") {
      setIsAuthenticated(true);
    } else {
      alert("Nesprávne heslo");
    }
  };

  const handleSave = async (promise: any, isNew: boolean = false) => {
    try {
      const res = await fetch('/api/admin/promises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
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
        fetchPromises();
      } else {
        alert("Chyba pri ukladaní: " + json.error);
      }
    } catch (e) {
      alert("Systémová chyba");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete vymazať tento sľub?")) return;
    try {
      const res = await fetch('/api/admin/promises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({
          action: 'DELETE',
          promise: { id }
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchPromises();
      }
    } catch (e) {
      alert("Systémová chyba");
    }
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({ ...p });
    setIsCreating(false);
  };

  const startCreate = () => {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      {!isAuthenticated ? (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-2xl font-bold text-center mb-6">Administrácia Sľubov</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heslo</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Zadajte heslo..."
              />
            </div>
            <button type="submit" className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg hover:bg-amber-700">
              Vstúpiť
            </button>
          </form>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <div className="mb-4">
              <Link href="/admin" className="text-sm font-medium text-blue-600 hover:underline mr-4">
                &larr; Späť na hlavný Admin
              </Link>
              <Link href="/slubomer" className="text-sm font-medium text-amber-600 hover:underline">
                Zobraziť verejný Sľubomer &rarr;
              </Link>
            </div>
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Lightbulb className="text-amber-500 w-8 h-8" />
                Správa Sľubov
              </h1>
              <button onClick={startCreate} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Nový Sľub
              </button>
            </div>
          </header>

          {isCreating && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 mb-8">
              <h2 className="text-xl font-bold mb-4 text-amber-900">Pridať nový sľub</h2>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <input type="text" placeholder="Názov sľubu (napr. Nová plaváreň)" className="border p-2 rounded" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                <textarea placeholder="Detailný popis" className="border p-2 rounded" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                <div className="flex gap-4">
                  <select className="border p-2 rounded flex-1" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="SPLNENÉ">SPLNENÉ</option>
                    <option value="V RIEŠENÍ">V RIEŠENÍ</option>
                    <option value="ZABUDNUTÉ">ZABUDNUTÉ</option>
                  </select>
                  <input type="text" placeholder="Politik" className="border p-2 rounded flex-1" value={editForm.politician_name} onChange={e => setEditForm({...editForm, politician_name: e.target.value})} />
                </div>
                <input type="text" placeholder="Link na zdroj (URL programu)" className="border p-2 rounded" value={editForm.source_url} onChange={e => setEditForm({...editForm, source_url: e.target.value})} />
                <input type="text" placeholder="Zmluvy (Zadajte ID zmlúv oddelené čiarkou)" className="border p-2 rounded" value={(editForm.related_transaction_ids || []).join(',')} onChange={e => {
                  const ids = e.target.value.split(',').map(i => i.trim()).filter(Boolean);
                  setEditForm({...editForm, related_transaction_ids: ids});
                }} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50">Zrušiť</button>
                <button onClick={() => handleSave(editForm, true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Vytvoriť sľub</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {promises.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                {editingId === p.id ? (
                  <div>
                    <input type="text" className="border p-2 rounded w-full mb-2 font-bold" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                    <textarea className="border p-2 rounded w-full mb-2" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                    <div className="flex gap-4 mb-2">
                      <select className="border p-2 rounded flex-1" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                        <option value="SPLNENÉ">SPLNENÉ</option>
                        <option value="V RIEŠENÍ">V RIEŠENÍ</option>
                        <option value="ZABUDNUTÉ">ZABUDNUTÉ</option>
                      </select>
                      <input type="text" className="border p-2 rounded flex-1" value={editForm.politician_name} onChange={e => setEditForm({...editForm, politician_name: e.target.value})} />
                    </div>
                    <input type="text" placeholder="Zdroj URL" className="border p-2 rounded w-full mb-2" value={editForm.source_url} onChange={e => setEditForm({...editForm, source_url: e.target.value})} />
                    <input type="text" placeholder="Zmluvy (ID oddelené čiarkou)" className="border p-2 rounded w-full mb-4" value={(editForm.related_transaction_ids || []).join(',')} onChange={e => {
                      const ids = e.target.value.split(',').map(i => i.trim()).filter(Boolean);
                      setEditForm({...editForm, related_transaction_ids: ids});
                    }} />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-slate-700">Zrušiť</button>
                      <button onClick={() => handleSave(editForm, false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1"><Check className="w-4 h-4"/> Uložiť</button>
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
                      <p className="text-slate-600 text-sm mb-2">{p.description}</p>
                      <div className="text-xs font-mono text-slate-400">
                        {p.related_transaction_ids && p.related_transaction_ids.length > 0 && (
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Prepojených zmlúv: {p.related_transaction_ids.length}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-5 h-5"/></button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
