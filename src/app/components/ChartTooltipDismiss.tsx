"use client";
import { useEffect } from "react";

/**
 * On touch devices the chart tooltip is pinned to the bottom of the viewport
 * (see globals.css) so it can't render off-screen. But recharts doesn't clear
 * the tooltip on scroll (no mouseleave fires on touch), so it would stay stuck
 * at the bottom while scrolling. This hides it on scroll and re-enables it on
 * the next tap — pure DOM/CSS, no fighting recharts' internal state.
 */
export default function ChartTooltipDismiss() {
  useEffect(() => {
    const hide = () => document.body.classList.add("charts-scrolled");
    const show = () => document.body.classList.remove("charts-scrolled");
    window.addEventListener("scroll", hide, { passive: true });
    // A fresh tap re-enables the tooltip; capture so it runs before recharts.
    document.addEventListener("pointerdown", show, { capture: true });
    return () => {
      window.removeEventListener("scroll", hide);
      document.removeEventListener("pointerdown", show, { capture: true } as EventListenerOptions);
    };
  }, []);
  return null;
}
