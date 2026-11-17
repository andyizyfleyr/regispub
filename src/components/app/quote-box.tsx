import { cn, formatFcfa } from "@/lib/utils";
import type { QuoteLine } from "@/lib/pricing/quote";

const LABELS: Record<QuoteLine["kind"], string> = { AD_BUDGET: "Budget publicitaire", SERVICE_FEE: "Frais de prestation", EXTRA_PLATFORM: "Plateforme supplémentaire", DISCOUNT: "Remise", PAYMENT_FEE: "Frais de paiement" };
const HINTS: Partial<Record<QuoteLine["kind"], string>> = { AD_BUDGET: "Reversé en totalité aux plateformes publicitaires", SERVICE_FEE: "Rémunère notre travail", PAYMENT_FEE: "Prélevés par l'opérateur Mobile Money" };

/** Détail d'un devis : budget publicitaire, frais de prestation, frais de paiement et total, toujours séparés. */
export function QuoteLines({ lines, total, className, totalLabel = "Total à payer" }: { lines: QuoteLine[]; total: number; className?: string; totalLabel?: string }) {
  return (
    <dl className={cn("text-sm", className)}>
      {lines.map((l, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2">
          <dt className="min-w-0">
            <span className="text-ink">{l.label || LABELS[l.kind]}</span>
            <span className="block text-xs text-muted">{l.hint ?? HINTS[l.kind]}</span>
          </dt>
          <dd className={cn("tnum shrink-0 font-medium", l.amount < 0 && "text-green")}>{l.amount < 0 ? `− ${formatFcfa(-l.amount)}` : formatFcfa(l.amount)}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-dashed border-line-strong pt-3">
        <dt className="font-semibold text-ink">{totalLabel}</dt>
        <dd className="tnum font-display text-[26px] font-semibold leading-none">{formatFcfa(total)}</dd>
      </div>
    </dl>
  );
}
