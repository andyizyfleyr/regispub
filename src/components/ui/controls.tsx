"use client";

import * as React from "react";
import { Checkbox as C, Popover as P, Slider as Sl, Switch as S, Tooltip as T } from "radix-ui";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Interrupteur ── */
export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn("relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-green", className)}
      {...props}
    >
      <S.Thumb className="block size-[22px] translate-x-[3px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 data-[state=checked]:translate-x-[23px]" />
    </S.Root>
  );
}

/* ── Case à cocher ── */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn("flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-[1.5px] border-line-strong bg-surface text-white transition-colors hover:border-green focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-green data-[state=checked]:bg-green", className)}
      {...props}
    >
      <C.Indicator className="animate-pop"><Check className="size-3.5" strokeWidth={3.2} /></C.Indicator>
    </C.Root>
  );
}

/** Ligne de réglage : icône, libellé, interrupteur ou case à droite. */
export function ToggleRow({ icon, label, hint, htmlFor, children, className }: { icon?: React.ReactNode; label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3", className)}>
      {icon && <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-soft text-green [&_svg]:size-[18px]">{icon}</span>}
      <label htmlFor={htmlFor} className="min-w-0 flex-1 cursor-pointer text-sm font-medium text-ink">
        {label}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Curseur ── */
export function Slider({ value, min, max, step = 1, onChange, label, className }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; className?: string }) {
  return (
    <Sl.Root
      className={cn("relative flex h-7 w-full touch-none select-none items-center", className)}
      value={[Math.min(max, Math.max(min, value))]} min={min} max={max} step={step}
      onValueChange={(v) => onChange(v[0] ?? min)}
    >
      <Sl.Track className="relative h-2 grow overflow-hidden rounded-full bg-line"><Sl.Range className="absolute h-full rounded-full bg-green" /></Sl.Track>
      <Sl.Thumb aria-label={label} className="block size-6 cursor-grab rounded-full border-[3px] border-green bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18)] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green/20 active:scale-110 active:cursor-grabbing" />
    </Sl.Root>
  );
}

/* ── Infobulle ── */
const tipClass = "z-[70] max-w-[15rem] animate-pop rounded-lg bg-forest px-3 py-2 text-[12.5px] leading-snug text-white shadow-pop";

export function Tip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal><T.Content side={side} sideOffset={6} className={tipClass}>{label}<T.Arrow className="fill-forest" /></T.Content></T.Portal>
      </T.Root>
    </T.Provider>
  );
}

/** Petit « i » : l'explication s'ouvre au survol, au focus ou au toucher. */
export function InfoTip({ label, className }: { label: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <T.Provider delayDuration={100}>
      <T.Root open={open} onOpenChange={setOpen}>
        <T.Trigger asChild>
          <button type="button" aria-label="Explication" onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted hover:text-ink", className)}>
            <Info className="size-3.5" />
          </button>
        </T.Trigger>
        <T.Portal><T.Content sideOffset={4} className={tipClass} onPointerDownOutside={() => setOpen(false)}>{label}<T.Arrow className="fill-forest" /></T.Content></T.Portal>
      </T.Root>
    </T.Provider>
  );
}

/* ── Sélecteur de date ── */
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function parts(v: string | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function DatePicker({ id, name, value, defaultValue, min, max, onChange, placeholder = "Choisir", className }: {
  id?: string; name?: string; value?: string; defaultValue?: string; min?: string; max?: string; onChange?: (e: { target: { value: string } }) => void; placeholder?: string; className?: string;
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = value ?? inner;
  const sel = parts(current);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => { const p = sel ?? parts(min) ?? parts(max); const n = new Date(); return p ? { y: p.y, m: p.m } : { y: n.getFullYear(), m: n.getMonth() }; });
  const [todayIso, setTodayIso] = React.useState("");
  React.useEffect(() => { const n = new Date(); setTodayIso(iso(n.getFullYear(), n.getMonth(), n.getDate())); }, []);

  const first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const move = (d: number) => setView((v) => { const m = v.m + d; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const pick = (d: number) => { const v = iso(view.y, view.m, d); setInner(v); onChange?.({ target: { value: v } }); setOpen(false); };
  const navBtn = "flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-sand disabled:opacity-30";

  return (
    <P.Root open={open} onOpenChange={(o) => { setOpen(o); if (o && sel) setView({ y: sel.y, m: sel.m }); }}>
      {name && <input type="hidden" name={name} value={current} />}
      <P.Trigger id={id} type="button"
        className={cn("flex h-11 w-full items-center gap-2.5 rounded-md border border-line-strong bg-surface px-3.5 text-left text-[15px] text-ink transition-[border-color,box-shadow] hover:border-ink/30 focus:border-green focus:outline-none focus:ring-4 focus:ring-green/12 data-[state=open]:border-green data-[state=open]:ring-4 data-[state=open]:ring-green/12", className)}>
        <CalendarDays className="size-[18px] shrink-0 text-green" />
        <span className={cn("tnum min-w-0 flex-1 truncate", !sel && "text-muted/70")}>{sel ? `${sel.d} ${SHORT[sel.m]} ${sel.y}` : placeholder}</span>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={6} collisionPadding={12} className="z-[70] w-[19rem] animate-pop rounded-2xl border border-line bg-surface p-3 shadow-pop focus:outline-none">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={navBtn} onClick={() => move(-1)} aria-label="Mois précédent"><ChevronLeft className="size-4" /></button>
            <p className="text-sm font-semibold capitalize text-ink">{MONTHS[view.m]} {view.y}</p>
            <button type="button" className={navBtn} onClick={() => move(1)} aria-label="Mois suivant"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {DAYS.map((d, i) => <span key={i} className="py-1.5 text-[11px] font-medium text-muted">{d}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const v = iso(view.y, view.m, d);
              const off = Boolean((min && v < min) || (max && v > max));
              const on = v === current;
              return (
                <button key={i} type="button" disabled={off} onClick={() => pick(d)} aria-pressed={on} aria-label={`${d} ${MONTHS[view.m]} ${view.y}`}
                  className={cn("tnum mx-auto flex size-9 items-center justify-center rounded-full text-[13.5px] transition-colors", on ? "bg-forest font-semibold text-white" : off ? "text-muted/40" : "text-ink hover:bg-green-soft", !on && v === todayIso && "ring-1 ring-inset ring-green")}>
                  {d}
                </button>
              );
            })}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
