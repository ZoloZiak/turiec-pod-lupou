"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Mode | null) ?? "system";
  });
  // Renderuje sa až po hydratácii (server vráti "system", klient reálnu voľbu
  // z localStorage), aby ikona/label nespôsobili hydration mismatch. Bez
  // setState v efekte — spĺňa react-hooks/set-state-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    // keep in sync with OS while in system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next: Mode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
    apply(next);
  }

  if (!mounted) return null;

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label =
    mode === "light" ? "Svetlá téma" : mode === "dark" ? "Tmavá téma" : "Podľa systému";

  return (
    <button
      onClick={cycle}
      aria-label={`Téma: ${label}. Kliknutím prepnete.`}
      title={`Téma: ${label}`}
      className="fixed bottom-4 right-4 z-50 flex items-center justify-center h-11 w-11 rounded-full border border-line bg-card text-body shadow-lg hover:bg-elevated transition-colors"
    >
      <Icon size={20} />
    </button>
  );
}
