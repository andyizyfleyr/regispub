import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, actionsFrom, eyebrow, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; /** `lg` : les actions ne s'affichent que sur ordinateur. */ actionsFrom?: "lg"; eyebrow?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-4 flex animate-rise flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-3.5 text-[0.8125rem] font-medium text-ink-soft shadow-card transition-colors hover:text-ink">
            <ArrowLeft className="size-4" />{back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[1.375rem] font-semibold leading-[1.15] sm:text-[2.125rem] sm:leading-[1.1]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[0.875rem] text-muted sm:mt-1.5 sm:text-[0.9375rem]">{description}</p>}
      </div>
      {actions && <div className={cn("flex shrink-0 flex-wrap items-center gap-2", actionsFrom === "lg" && "max-lg:hidden")}>{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, art, title, description, action, className }: { icon?: React.ReactNode; art?: "megaphone" | "phone" | "chart" | "box"; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-line/70 bg-surface px-6 text-center shadow-card", art ? "py-9" : "py-12", className)}>
      {art && <Image src={`/img/3d/${art}.webp`} alt="" width={280} height={280} unoptimized className="mb-2 size-36 mix-blend-multiply" />}
      {icon && !art && (
        <div className="relative mb-4 flex size-14 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-green-soft" />
          <span aria-hidden className="absolute -inset-2 rounded-full border border-green/15" />
          <span className="relative text-green [&_svg]:size-6">{icon}</span>
        </div>
      )}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const NOTICE = {
  info: { cls: "bg-sky-soft", icon: "bg-sky text-white", Icon: Info },
  warn: { cls: "bg-marigold-soft", icon: "bg-marigold text-forest", Icon: TriangleAlert },
  danger: { cls: "bg-clay-soft", icon: "bg-clay text-white", Icon: CircleAlert },
  ok: { cls: "bg-green-soft", icon: "bg-green text-white", Icon: CircleCheck },
} as const;

export function Notice({ tone = "info", title, children, className }: { tone?: keyof typeof NOTICE; title?: string; children?: React.ReactNode; className?: string }) {
  const { cls, icon, Icon } = NOTICE[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg px-4 py-3.5 text-[0.84375rem] leading-relaxed", cls, className)}>
      <span className={cn("mt-px flex size-7 shrink-0 items-center justify-center rounded-full", icon)}><Icon className="size-3.5" /></span>
      <div className="min-w-0 text-ink-soft">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export type StatTone = "green" | "marigold" | "sky" | "violet" | "rose" | "neutral";
const STAT_TONES: Record<StatTone, string> = {
  green: "bg-green-soft text-green", marigold: "bg-marigold-soft text-[#9a6400]", sky: "bg-sky-soft text-sky",
  violet: "bg-violet-soft text-violet", rose: "bg-rose-soft text-rose", neutral: "bg-sand text-ink-soft",
};

/** Chiffre clé. Toutes les cartes ont la même forme : libellé, valeur, précision, sur une ligne chacun. */
export function Stat({ label, value, hint, icon, tone = "neutral", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: StatTone; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-line/70 bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[0.8125rem] leading-5 text-muted">{label}</p>
        {icon && <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4", STAT_TONES[tone])}>{icon}</span>}
      </div>
      <p className="tnum mt-2 truncate font-display text-[1.375rem] font-semibold leading-none text-ink sm:text-[1.625rem]">{value}</p>
      <p className="mt-1.5 truncate text-xs leading-4 text-muted sm:mt-2" title={typeof hint === "string" ? hint : undefined}>{hint || "\u00a0"}</p>
    </div>
  );
}

/** Onglets en pastilles (liens) : l'onglet actif est porté par l'URL. */
export function TabsNav({ tabs, current, className }: { tabs: { href: string; label: string; id: string; count?: number; icon?: React.ReactNode }[]; current: string; className?: string }) {
  return (
    <div className={cn("scrollbar-none -mx-4 mb-5 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0", className)}>
      <nav className="inline-flex gap-1 rounded-full border border-line/70 bg-surface p-1 shadow-card">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} scroll={false} aria-current={t.id === current ? "page" : undefined}
            className={cn("flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors", t.id === current ? "bg-forest text-white" : "text-muted hover:text-ink")}>
            {t.icon && <span aria-hidden className="[&_svg]:size-4">{t.icon}</span>}
            {t.label}
            {t.count ? <span className="tnum rounded-full bg-marigold px-1.5 text-[11px] font-semibold leading-5 text-forest">{t.count}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Tableau. Sur téléphone, chaque ligne devient une fiche : la première colonne sert de titre, les autres
 * s'empilent avec leur libellé à gauche et leur valeur à droite, toujours aux mêmes positions.
 * Une colonne sans en-tête (boutons) se cale à droite, en bas de la fiche. Une cellule `data-empty` disparaît.
 * `mobile="fit"` garde un vrai tableau resserré, pour une série de chiffres : on masque des colonnes jusqu'à ce qu'il tienne dans l'écran.
 * `mobile="scroll"` garde le tableau entier, à faire défiler. Numéros de colonne à partir de 1 :
 * `mobileHide` masque des colonnes sur téléphone, `mobileCorner` place une colonne (l'état) en haut à droite, en face du titre.
 */
export function Table({ head, children, className, mobile = "stack", mobileHide, mobileCorner }: { head: React.ReactNode[]; children: React.ReactNode; className?: string; mobile?: "stack" | "fit" | "scroll"; mobileHide?: number[]; mobileCorner?: number }) {
  const stack = mobile === "stack";
  const plain = head.map((h, i) => (i > 0 && !h ? i + 1 : 0)).filter(Boolean);
  const labels = Object.fromEntries(head.map((h, i) => [`--l${i + 1}`, JSON.stringify(typeof h === "string" ? h : "")])) as React.CSSProperties;
  return (
    <div className={cn("overflow-x-auto", stack && "table-stack", mobile === "fit" && "table-fit", className)} style={stack ? labels : undefined} data-hide={mobile !== "scroll" && mobileHide?.length ? mobileHide.join(" ") : undefined}
      data-corner={stack && mobileCorner ? mobileCorner : undefined} data-plain={stack && plain.length ? plain.join(" ") : undefined}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-[0.75rem] uppercase tracking-wider text-muted">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-medium first:pl-5 last:pr-5">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_tr]:border-b [&_tr]:border-line [&_tr]:transition-colors [&_tr:hover]:bg-paper/70 [&_tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

/** Fiche d'informations : une ligne par information, le libellé à gauche, la valeur à droite. */
export function DefinitionList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:gap-6">
          <dt className="shrink-0 text-[0.8125rem] text-muted sm:w-44 sm:pt-px">{it.label}</dt>
          <dd className="min-w-0 flex-1 break-words text-sm text-ink">{it.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
