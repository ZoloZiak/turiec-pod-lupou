"use client";

import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Disclosure — ELI5 postupné odhaľovanie, JEDNA vrstva.
 * Nadpis (summary) + jedna veta (lead) sú vždy vidno; detail/dáta sa rozbalia PRIAMO VNÚTRI
 * až keď čitateľ klikne. Žiadne odkazy, ktoré ho posielajú inam na stránku.
 */
export default function Disclosure({
  summary,
  lead,
  children,
  defaultOpen = false,
  tone = "default",
}: {
  summary: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "accent";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ring =
    tone === "accent"
      ? "border-purple-300 dark:border-purple-900/70"
      : "border-line";

  return (
    <div className={`rounded-xl border ${ring} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-elevated/60 transition-colors"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-body">{summary}</span>
          {lead && <span className="block text-xs text-muted mt-0.5">{lead}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 mt-0.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-line/70">{children}</div>}
    </div>
  );
}
