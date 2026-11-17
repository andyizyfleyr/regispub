import * as React from "react";
import Link from "next/link";
import { CircleAlert, Info, TriangleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-2 inline-block text-[13px] text-muted hover:text-ink">← {back.label}</Link>}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-sand text-ink-soft [&_svg]:size-5">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const NOTICE = {
  info: { cls: "border-sky/20 bg-sky-soft text-sky", Icon: Info },
  warn: { cls: "border-marigold/40 bg-marigold-soft text-[#7a4f00]", Icon: TriangleAlert },
  danger: { cls: "border-clay/25 bg-clay-soft text-clay", Icon: CircleAlert },
  ok: { cls: "border-green/20 bg-green-soft text-green", Icon: CircleCheck },
} as const;

export function Notice({ tone = "info", title, children, className }: { tone?: keyof typeof NOTICE; title?: string; children?: React.ReactNode; className?: string }) {
  const { cls, Icon } = NOTICE[tone];
  return (
    <div className={cn("flex gap-3 rounded-md border px-3.5 py-3 text-[13.5px] leading-relaxed", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-ink-soft">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card", className)}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="tnum mt-1 font-display text-[22px] font-semibold leading-none text-ink">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TabsNav({ tabs, current, className }: { tabs: { href: string; label: string; id: string; count?: number }[]; current: string; className?: string }) {
  return (
    <nav className={cn("scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0", className)}>
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} scroll={false} aria-current={t.id === current ? "page" : undefined}
          className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", t.id === current ? "border-forest text-ink" : "border-transparent text-muted hover:text-ink")}>
          {t.label}
          {t.count ? <span className="tnum rounded-full bg-marigold px-1.5 text-[11px] font-semibold leading-5 text-forest">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Table({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-wider text-muted">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 font-medium first:pl-5 last:pr-5">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

export function DefinitionList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[12.5px] text-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink">{it.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
