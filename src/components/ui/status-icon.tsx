"use client";

import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";
import { TONES, type Tone } from "./tones";

const LONG_PRESS_MS = 400; // avant le menu du navigateur sur un lien
const HOLD_MS = 2200; // durée d'affichage après un appui long
const MOVE_TOLERANCE = 10; // au-delà, le doigt fait défiler la page

const tipClass = "z-[70] max-w-[15rem] animate-pop select-none rounded-lg bg-forest px-3 py-1.5 text-[0.78125rem] font-medium leading-snug text-white shadow-pop";

/**
 * État affiché en pastille ronde colorée, sans texte. Le libellé s'ouvre dans une bulle :
 * au survol à la souris, après un appui long au doigt. Les lecteurs d'écran lisent le libellé.
 */
export function StatusIcon({ label, tone = "neutral", className, children }: { label: string; tone?: Tone; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const press = React.useRef<number | null>(null);
  const hide = React.useRef<number | null>(null);
  const origin = React.useRef<{ x: number; y: number } | null>(null);
  const holdUntil = React.useRef(0);
  const longPressed = React.useRef(false);
  const touch = React.useRef(false);

  const clear = (t: React.RefObject<number | null>) => { if (t.current !== null) { window.clearTimeout(t.current); t.current = null; } };
  const close = React.useCallback(() => { holdUntil.current = 0; clear(hide); setOpen(false); }, []);
  React.useEffect(() => () => { clear(press); clear(hide); }, []);

  // Bulle ouverte au doigt : elle se ferme dès que la page défile ou qu'on touche ailleurs.
  React.useEffect(() => {
    if (!open || !touch.current) return;
    const onDown = () => { if (press.current === null) close(); };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("pointerdown", onDown, true); };
  }, [open, close]);

  return (
    <T.Provider delayDuration={120} disableHoverableContent>
      <T.Root open={open} onOpenChange={(next) => { if (!next && Date.now() < holdUntil.current) return; setOpen(next); }}>
        <T.Trigger asChild>
          <span
            role="img" aria-label={label} data-status-icon=""
            className={cn("relative inline-flex size-6 shrink-0 select-none items-center justify-center rounded-full align-middle [-webkit-touch-callout:none] before:absolute before:-inset-2 before:content-[''] [&_svg]:size-3.5 [&_svg]:stroke-[2.4]", TONES[tone], className)}
            onPointerDown={(e) => {
              touch.current = e.pointerType !== "mouse";
              longPressed.current = false;
              if (!touch.current) return;
              origin.current = { x: e.clientX, y: e.clientY };
              clear(press);
              press.current = window.setTimeout(() => {
                press.current = null;
                longPressed.current = true;
                holdUntil.current = Date.now() + HOLD_MS;
                setOpen(true);
                clear(hide);
                hide.current = window.setTimeout(close, HOLD_MS);
              }, LONG_PRESS_MS);
            }}
            onPointerMove={(e) => {
              const o = origin.current;
              if (press.current !== null && o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) clear(press);
            }}
            onPointerUp={() => clear(press)}
            onPointerCancel={() => clear(press)}
            onPointerLeave={() => clear(press)}
            // Après un appui long, le doigt se relève sans ouvrir la ligne ni le menu du navigateur.
            onContextMenu={(e) => { if (touch.current) e.preventDefault(); }}
            onClickCapture={(e) => { if (longPressed.current) { longPressed.current = false; e.preventDefault(); e.stopPropagation(); } }}
          >
            {children}
          </span>
        </T.Trigger>
        <T.Portal>
          <T.Content side="top" sideOffset={6} collisionPadding={8} className={tipClass}>{label}<T.Arrow className="fill-forest" /></T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
