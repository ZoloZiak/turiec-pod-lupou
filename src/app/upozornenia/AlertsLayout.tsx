"use client";
import { useState } from 'react';

export default function AlertsLayout({ children1, children2 }: { children1: React.ReactNode, children2: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'100k' | 'crz'>('100k');
  
  return (
    <>
      <div className="lg:hidden flex gap-2 mb-6">
        <button onClick={() => setActiveTab('100k')} className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${activeTab === '100k' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800' : 'bg-card text-muted border border-line hover:bg-elevated'}`}>Nad 100 000 €</button>
        <button onClick={() => setActiveTab('crz')} className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${activeTab === 'crz' ? 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800' : 'bg-card text-muted border border-line hover:bg-elevated'}`}>Chýba zmluva</button>
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
