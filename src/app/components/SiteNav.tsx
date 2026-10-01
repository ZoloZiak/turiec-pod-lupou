"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, Menu, X, ChevronDown,
  Wallet, ShieldAlert, Users, Landmark,
  FileText, ShoppingCart, Coins, Receipt,
  TrendingUp, ClipboardCheck, Vote, Lightbulb, Building2, Droplets, Network,
} from "lucide-react";

type Item = { href: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }> };
type Group = { key: string; label: string; question: string; icon: React.ComponentType<{ className?: string }>; accent: string; items: Item[] };

// Informačná architektúra: 4 skupiny podľa otázky, ktorú si občan kladie.
// Zmena tu = zmena v celom webe (jednotné menu na každej stránke).
const GROUPS: Group[] = [
  {
    key: "peniaze",
    label: "Peniaze",
    question: "Kam idú peniaze mesta?",
    icon: Wallet,
    accent: "emerald",
    items: [
      { href: "/zmluvy", label: "Zmluvy mesta", desc: "Evidencia zmlúv od 2011", icon: FileText },
      { href: "/objednavky", label: "Objednávky", desc: "Objednávky mesta 2011–2026", icon: ShoppingCart },
      { href: "/eurofondy", label: "Eurofondy a dotácie", desc: "Peniaze, ktoré prišli DO mesta", icon: Coins },
      { href: "/#faktury", label: "Faktúry", desc: "Zoznam významných faktúr", icon: Receipt },
    ],
  },
  {
    key: "kontrola",
    label: "Kontrola",
    question: "Čo nesedí?",
    icon: ShieldAlert,
    accent: "amber",
    items: [
      { href: "/kontrola", label: "Otázniky (audit)", desc: "Platby bez zmluvy, dodávatelia mimo RPVS", icon: ShieldAlert },
      { href: "/analyzy", label: "Analýzy a anomálie", desc: "Vývoj výdavkov, koncoročný zhon", icon: TrendingUp },
      { href: "/nku", label: "Nezávislé kontroly", desc: "NKÚ SR a hlavný kontrolór mesta", icon: ClipboardCheck },
    ],
  },
  {
    key: "ludia",
    label: "Ľudia a moc",
    question: "Kto rozhoduje a plní sľuby?",
    icon: Users,
    accent: "purple",
    items: [
      { href: "/poslanci", label: "Hlasovania MsZ", desc: "Menovité hlasovania poslancov", icon: Vote },
      { href: "/dramy", label: "Drámy zastupiteľstva", desc: "Kľúčové hlasovania rozobrané", icon: TrendingUp },
      { href: "/vzory", label: "Vzory v hlasovaní", desc: "Kto s kým drží, opozícia, účasť", icon: Network },
      { href: "/majetky", label: "Majetky funkcionárov", desc: "Priznania príjmov a majetku", icon: ShieldAlert },
      { href: "/slubomer", label: "Sľubomer", desc: "Plnenie predvolebných sľubov", icon: Lightbulb },
    ],
  },
  {
    key: "mesto",
    label: "Mesto vlastní",
    question: "Čo mesto spravuje?",
    icon: Landmark,
    accent: "blue",
    items: [
      { href: "/podniky", label: "Mestské podniky", desc: "Finančné zdravie firiem mesta", icon: Building2 },
      { href: "/voda", label: "Voda a infraštruktúra", desc: "Analýza vodárenskej siete", icon: Droplets },
    ],
  },
];

const accentText: Record<string, string> = {
  emerald: "text-emerald-400", amber: "text-amber-400", purple: "text-purple-400", blue: "text-blue-400",
};
const accentBg: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
  amber: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
  purple: "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20",
  blue: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
};

export default function SiteNav() {
  const [open, setOpen] = useState(false); // mobile menu
  const [dropdown, setDropdown] = useState<string | null>(null); // desktop dropdown key
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // zavri dropdown pri kliku mimo
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setDropdown(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // zavri všetko pri zmene stránky (legitímna synchronizácia UI so zmenou route)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    setDropdown(null);
  }, [pathname]);

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return base !== "/" && pathname.startsWith(base);
  };
  const groupActive = (g: Group) => g.items.some(i => isActive(i.href));

  return (
    <header className="bg-card/80 backdrop-blur-md border-b border-line sticky top-0 z-40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div ref={navRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Turiec pod Lupou — domov">
          <Search className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight text-body">Turiec pod Lupou</span>
        </Link>

        {/* DESKTOP: 4 dropdown skupiny */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Hlavná navigácia">
          {GROUPS.map(g => {
            const Icon = g.icon;
            const isOpen = dropdown === g.key;
            return (
              <div key={g.key} className="relative">
                <button
                  onClick={() => setDropdown(isOpen ? null : g.key)}
                  aria-expanded={isOpen}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isOpen || groupActive(g) ? `bg-elevated ${accentText[g.accent]}` : "text-body hover:bg-elevated"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${accentText[g.accent]}`} />
                  {g.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-card border border-line rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="px-3 pt-1.5 pb-2 text-[11px] font-semibold text-muted italic">{g.question}</p>
                    {g.items.map(it => {
                      const ItIcon = it.icon;
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            isActive(it.href) ? "bg-elevated" : "hover:bg-elevated"
                          }`}
                        >
                          <ItIcon className={`w-4 h-4 mt-0.5 shrink-0 ${accentText[g.accent]}`} />
                          <span>
                            <span className="block text-sm font-semibold text-body">{it.label}</span>
                            <span className="block text-xs text-muted leading-snug">{it.desc}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* MOBILE toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden p-2 text-muted hover:text-body rounded-lg"
          aria-label={open ? "Zavrieť menu" : "Otvoriť menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE dropdown: skupiny ako sekcie */}
      {open && (
        <div className="lg:hidden border-t border-line bg-card px-4 py-4 space-y-5 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
          {GROUPS.map(g => {
            const Icon = g.icon;
            return (
              <div key={g.key}>
                <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2 ${accentText[g.accent]}`}>
                  <Icon className="w-4 h-4" /> {g.label}
                </p>
                <div className="flex flex-col gap-2">
                  {g.items.map(it => (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${accentBg[g.accent]} ${accentText[g.accent]}`}
                    >
                      {it.label}
                      <span className="block text-[11px] text-muted font-normal">{it.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}
