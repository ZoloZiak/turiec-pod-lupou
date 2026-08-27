"use client";
import { useEffect } from "react";

/**
 * On touch devices the chart tooltip is pinned to the bottom of the viewport
 * (see globals.css) so it can't render off-screen. recharts doesn't clear a
 * tooltip on touch (no mouseleave), so two problems arise:
 *   1) after tapping a chart the tooltip stays pinned while scrolling;
 *   2) with several charts on a page, the FIRST chart's stale tooltip would
 *      pop back when you touch a DIFFERENT chart.
 *
 * Fix per-chart, not globally: suppress every chart's tooltip on scroll, and on
 * pointerdown reveal ONLY the tooltip of the chart actually being touched while
 * keeping every other chart's (stale) tooltip suppressed. Pure DOM/CSS.
 */
export default function ChartTooltipDismiss() {
  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
    const SUP = "tooltip-suppressed";

    const suppressAll = () => {
      document
        .querySelectorAll(".recharts-tooltip-wrapper")
        .forEach((tt) => tt.classList.add(SUP));
    };

    const onScroll = () => {
      if (isMobile()) suppressAll();
    };

    const onPointerDown = (e: Event) => {
      if (!isMobile()) return;
      const target = e.target as Element | null;
      const active = target?.closest?.(".recharts-wrapper") ?? null;
      // Reveal only the touched chart's tooltip; suppress all others (incl. stale).
      document.querySelectorAll(".recharts-wrapper").forEach((w) => {
        const tt = w.querySelector(".recharts-tooltip-wrapper");
        if (!tt) return;
        if (active && w === active) tt.classList.remove(SUP);
        else tt.classList.add(SUP);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener(
        "pointerdown",
        onPointerDown,
        { capture: true } as EventListenerOptions
      );
    };
  }, []);
  return null;
}
