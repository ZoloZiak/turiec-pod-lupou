import SiteNav from "./components/SiteNav";
import BudgetFunnel from "./components/BudgetFunnel";

export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-body font-sans selection:bg-emerald-500/30">
      <SiteNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <BudgetFunnel />
      </main>
    </div>
  );
}
