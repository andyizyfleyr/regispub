"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER = 70;

/** Tirer vers le bas pour actualiser (écrans tactiles). Recharge les données sans perdre la saisie en cours. */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [busy, start] = React.useTransition();

  React.useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    let y0: number | null = null;
    let d = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      y0 = window.scrollY <= 0 && e.touches.length === 1 && !t?.closest("[role=dialog],[role=listbox],[data-no-pull],textarea,[role=slider]") ? e.touches[0]!.clientY : null;
      d = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (y0 === null) return;
      if (window.scrollY > 0) { y0 = null; d = 0; setPull(0); return; }
      d = Math.max(0, (e.touches[0]!.clientY - y0) * 0.45);
      setPull(Math.min(d, 96));
    };
    const onEnd = () => {
      if (y0 !== null && d >= TRIGGER) start(() => router.refresh());
      y0 = null; d = 0; setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      root.style.overscrollBehaviorY = previous;
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const shown = busy ? 56 : pull;
  const ready = pull >= TRIGGER;
  return (
    <div aria-hidden={!busy} role="status" className="no-print pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center lg:hidden"
      style={{ transform: `translateY(${shown - 44}px)`, opacity: Math.min(1, shown / 40), transition: pull ? "none" : "transform 0.25s, opacity 0.25s" }}>
      <span className={cn("flex size-10 items-center justify-center rounded-full border border-line bg-surface shadow-pop", ready || busy ? "text-green" : "text-muted")}>
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowDown className="size-5 transition-transform duration-200" style={{ transform: ready ? "rotate(180deg)" : undefined }} />}
      </span>
      {busy && <span className="sr-only">Actualisation…</span>}
    </div>
  );
}
