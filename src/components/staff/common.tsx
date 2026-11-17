import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

export function pageOf(raw: string | undefined) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 1 ? Math.min(n, 400) : 1;
}

/** Construit une URL en conservant les filtres courants. */
export function hrefWith(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function SearchForm({ action, q, placeholder, hidden }: { action: string; q?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} className="flex w-full max-w-sm gap-2" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="pl-9" maxLength={80} />
      </div>
      <Button type="submit" variant="outline">Chercher</Button>
    </form>
  );
}

export function FilterChips({ items, current }: { items: { id: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((it) => (
        <Link key={it.id} href={it.href} aria-current={it.id === current ? "true" : undefined}
          className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors", it.id === current ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong")}>
          {it.label}{typeof it.count === "number" ? <span className={cn("tnum ml-1.5", it.id === current ? "text-white/70" : "text-muted")}>{it.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, total, base, params }: { page: number; total: number; base: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <p className="px-5 py-3 text-xs text-muted">{total} résultat{total > 1 ? "s" : ""}</p>;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
      <span className="tnum">{total} résultats · page {page} / {pages}</span>
      <span className="flex gap-1.5">
        {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={hrefWith(base, params, { page: page > 2 ? String(page - 1) : undefined })}><ChevronLeft />Précédent</Link></Button> : null}
        {page < pages ? <Button asChild variant="outline" size="sm"><Link href={hrefWith(base, params, { page: String(page + 1) })}>Suivant<ChevronRight /></Link></Button> : null}
      </span>
    </div>
  );
}
