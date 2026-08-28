"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ComponentType } from "react";

/**
 * Mobile-friendly info affordance: a small status icon that, when tapped,
 * reveals a text popover. On touch there is no hover, so `title=""` tooltips
 * are useless — this gives a real tap target. The popover is position:fixed and
 * clamped to the viewport so it can't render off-screen regardless of where the
 * icon sits in the row. Closes on outside click / Escape / scroll.
 */
export default function InfoIcon({
  icon: Icon,
  colorClass,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);

  // Position the popover above the icon, clamped into the viewport.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const b = btnRef.current!.getBoundingClientRect();
      const pop = popRef.current;
      const pw = pop ? pop.offsetWidth : Math.min(280, window.innerWidth - 24);
      const ph = pop ? pop.offsetHeight : 80;
      const margin = 12;
      let left = b.left + b.width / 2 - pw / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
      let top = b.top - ph - 8;
      if (top < margin) top = b.bottom + 8; // flip below if no room above
      setPos({ left, top });
    };
    place();
    // Re-place after the popover has measured its real size.
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popRef.current && !popRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center justify-center ${colorClass} p-0.5`}
        aria-label={label}
        aria-expanded={open}
      >
        <Icon className="w-4 h-4" />
      </button>
      {open && (
        <span
          ref={popRef}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
          className="fixed z-[60] w-max max-w-[calc(100vw-24px)] rounded-lg border border-line bg-card p-2.5 text-xs font-normal leading-snug text-body shadow-lg"
        >
          {children}
        </span>
      )}
    </>
  );
}
