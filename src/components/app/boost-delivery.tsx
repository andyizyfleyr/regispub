import { Check, ExternalLink } from "lucide-react";
import { PlatformBadge } from "@/components/icons";
import { StateIcon } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { BOOST_STATUS, boostLabel, type BoostKindCode, type BoostStatusName } from "@/lib/boost/catalog";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { cn, formatDateTime } from "@/lib/utils";

type Boost = { platform: string; kind: string; quantity: number; link: string; comments: string[]; status: string; cancelReason: string | null; startedAt: Date | null; deliveredAt: Date | null };

const STEPS: { id: BoostStatusName; label: string }[] = [{ id: "TO_DELIVER", label: "Payée" }, { id: "IN_PROGRESS", label: "En cours" }, { id: "DELIVERED", label: "Livrée" }];

/** Suivi de livraison d'une commande d'abonnés, de J'aime, de commentaires ou de vues, côté client. */
export function BoostDelivery({ boost, orderStatus, refundPending }: { boost: Boost; orderStatus: string; refundPending?: boolean }) {
  const status = boost.status as BoostStatusName;
  const kind = boost.kind as BoostKindCode;
  const platform = boost.platform as PlatformCode;
  const paid = status === "TO_DELIVER" || status === "IN_PROGRESS" || status === "DELIVERED";
  const reached = STEPS.findIndex((s) => s.id === status);
  const refunded = orderStatus === "REFUNDED" || orderStatus === "PARTIALLY_REFUNDED";
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={platform} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">{boostLabel(platform, kind, boost.quantity)}</p>
            <a href={boost.link} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-[0.8125rem] text-green hover:underline"><span className="truncate">{boost.link.replace(/^https?:\/\/(www\.)?/, "")}</span><ExternalLink className="size-3.5 shrink-0" aria-hidden /></a>
          </div>
          <StateIcon kind="boost" value={status} />
        </div>

        {paid && (
          <ol className="grid grid-cols-3 gap-2" aria-label="Avancement de la livraison">
            {STEPS.map((s, i) => {
              const done = i <= reached;
              return (
                <li key={s.id} aria-current={i === reached ? "step" : undefined} className="min-w-0">
                  <span className={cn("block h-1.5 rounded-full", done ? "bg-green" : "bg-sand")} />
                  <span className={cn("mt-1.5 flex items-center gap-1 text-[0.78125rem]", done ? "font-medium text-ink" : "text-muted")}>{done && <Check className="size-3.5 shrink-0 text-green" aria-hidden />}<span className="truncate">{s.label}</span></span>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-[0.84375rem] text-ink-soft">
          {status === "CANCELLED" && boost.cancelReason ? <>Commande annulée. {boost.cancelReason}{refunded ? " Vous avez été remboursé." : refundPending ? " Votre remboursement est en cours." : ""}</> : BOOST_STATUS[status]?.clientHint}
          {status === "DELIVERED" && boost.deliveredAt ? <span className="tnum text-muted"> · {formatDateTime(boost.deliveredAt)}</span> : null}
        </p>

        {boost.comments.length > 0 && (
          <details className="rounded-lg border border-line bg-paper/60 px-3.5 py-2.5 text-sm">
            <summary className="cursor-pointer font-medium text-ink-soft">Vos commentaires <span className="tnum font-normal text-muted">({boost.comments.length})</span></summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.84375rem] text-ink-soft">{boost.comments.map((c, i) => <li key={i} className="break-words">{c}</li>)}</ol>
          </details>
        )}
      </CardBody>
    </Card>
  );
}
