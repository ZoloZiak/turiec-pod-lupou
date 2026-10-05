"use client";

import SiteNav from "../components/SiteNav";
import Link from "next/link";
import { Wallet } from "lucide-react";
import BudgetPrograms from "../components/BudgetPrograms";

export default function RozpocetPage() {
  return (
    <div className="min-h-screen bg-surface text-body font-sans pb-20">
      <SiteNav />
      {/* HEADER */}
      <header className="bg-card border-b border-line pt-10 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">
            &larr; Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-3">
            <Wallet className="w-9 h-9 text-emerald-400" aria-hidden="true" /> Rozpočet mesta do hĺbky
          </h1>
          <p className="text-base sm:text-lg text-muted mt-4 max-w-3xl">
            Lievik na úvodnej stránke ukazuje, odkiaľ peniaze prichádzajú a kam idú v hrubých tokoch.
            Tu je ten istý rok rozobratý program po programe — až na úroveň konkrétnych podprogramov
            a toho, koľko reálne stáli.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <BudgetPrograms />
      </main>
    </div>
  );
}
