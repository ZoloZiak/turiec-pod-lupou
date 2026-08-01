"use client";
import { useState } from 'react';

export default function AlertsLayout({ children1, children2 }: { children1: React.ReactNode, children2: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'100k' | 'crz'>('100k');
  
  return (
    <>
      <div className="lg:hidden flex gap-2 mb-6">
        <button onClick={() => setActiveTab('100k')} className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${activeTab === '100k' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Nad 100 000 €</button>
        <button onClick={() => setActiveTab('crz')} className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${activeTab === 'crz' ? 'bg-red-100 text-red-900 border border-red-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Chýba zmluva</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className={`${activeTab === '100k' ? 'block' : 'hidden'} lg:block`}>
          {children1}
        </div>
        <div className={`${activeTab === 'crz' ? 'block' : 'hidden'} lg:block`}>
          {children2}
        </div>
      </div>
    </>
  );
}
