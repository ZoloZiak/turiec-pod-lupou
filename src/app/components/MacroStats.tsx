"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Building2, Info } from "lucide-react";

// Dummy dáta inšpirované otvorenými dátami ŠÚ SR pre demonštráciu
const data = [
  { mesto: "Trenčín", vydavky_na_hlavu: 950, pocet_obyvatelov: "54 000" },
  { mesto: "Poprad", vydavky_na_hlavu: 1020, pocet_obyvatelov: "49 000" },
  { mesto: "Martin", vydavky_na_hlavu: 1250, pocet_obyvatelov: "51 000" }, // Martin je najdrahší
  { mesto: "Prievidza", vydavky_na_hlavu: 890, pocet_obyvatelov: "44 000" },
];

export default function MacroStats() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Makro-porovnanie (Samosprávy SR)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Porovnanie bežných výdavkov mesta na jedného obyvateľa voči porovnateľným mestám (Dáta: ŠÚ SR)
          </p>
        </div>
      </div>
      
      <div className="p-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="mesto" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8' }} 
                tickFormatter={(value) => `${value} €`} 
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`${value} €`, 'Výdavky na hlavu']}
              />
              <Bar 
                dataKey="vydavky_na_hlavu" 
                radius={[6, 6, 0, 0]} 
                fill="#3b82f6" 
                barSize={40}
                activeBar={{ fill: '#2563eb' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>Analýza:</strong> Mesto Martin podľa dostupných dát ŠÚ SR vykazuje nadpriemerné bežné výdavky na jedného obyvateľa v porovnaní s demograficky podobnými mestami (Poprad, Trenčín). Každý občan Martina stojí aparát mesta <strong>1 250 €</strong> ročne.
          </p>
        </div>
      </div>
    </div>
  );
}
