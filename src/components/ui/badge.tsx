import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";

export type Tone = "neutral" | "warn" | "info" | "ok" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft",
  warn: "bg-marigold-soft text-[#8a5a00]",
  info: "bg-sky-soft text-sky",
  ok: "bg-green-soft text-green",
  danger: "bg-clay-soft text-clay",
  accent: "bg-forest text-white",
};

export function Badge({ tone = "neutral", dot, live, className, children }: { tone?: Tone; dot?: boolean; live?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-[1.375rem] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[0.75rem] font-semibold leading-none sm:h-6 sm:px-2.5", TONES[tone], className)}>
      {(dot || live) && (
        <span className="relative flex size-1.5">
          {live && <span className="absolute inset-0 animate-ping-soft rounded-full bg-current" />}
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function CampaignStatusBadge({ status, short }: { status: string; short?: boolean }) {
  const meta = STATUS_META[status as CampaignStatusName];
  return <Badge tone={meta?.tone ?? "neutral"} dot live={status === "RUNNING"}>{(short && meta?.short) || meta?.label || status}</Badge>;
}

const GENERIC: Record<string, { label: string; tone: Tone }> = {
  // commandes
  "order.PENDING": { label: "À régler", tone: "warn" }, "order.PAID": { label: "Payée", tone: "ok" }, "order.CANCELLED": { label: "Annulée", tone: "neutral" },
  "order.EXPIRED": { label: "Expirée", tone: "neutral" }, "order.PARTIALLY_REFUNDED": { label: "Remboursée en partie", tone: "info" }, "order.REFUNDED": { label: "Remboursée", tone: "info" },
  // paiements
  "payment.INITIATED": { label: "Initié", tone: "neutral" }, "payment.PENDING": { label: "En attente de validation", tone: "warn" }, "payment.SUCCEEDED": { label: "Confirmé", tone: "ok" },
  "payment.FAILED": { label: "Échoué", tone: "danger" }, "payment.CANCELLED": { label: "Annulé", tone: "neutral" }, "payment.EXPIRED": { label: "Expiré", tone: "neutral" },
  // remboursements
  "refund.REQUESTED": { label: "À traiter", tone: "warn" }, "refund.PROCESSED": { label: "Effectué", tone: "ok" }, "refund.REJECTED": { label: "Refusé", tone: "danger" },
  // validation des créations
  "approval.NOT_REQUIRED": { label: "Fourni", tone: "neutral" }, "approval.PENDING": { label: "À valider", tone: "warn" }, "approval.APPROVED": { label: "Validé", tone: "ok" }, "approval.CHANGES_REQUESTED": { label: "Modifications demandées", tone: "danger" },
  // demandes de modification
  "revision.OPEN": { label: "Ouverte", tone: "warn" }, "revision.IN_PROGRESS": { label: "En cours", tone: "info" }, "revision.DONE": { label: "Traitée", tone: "ok" }, "revision.REJECTED": { label: "Refusée", tone: "danger" },
  // réclamations
  "ticket.OPEN": { label: "Ouverte", tone: "warn" }, "ticket.IN_PROGRESS": { label: "En cours", tone: "info" }, "ticket.RESOLVED": { label: "Résolue", tone: "ok" }, "ticket.CLOSED": { label: "Clôturée", tone: "neutral" },
  // abonnements
  "subscription.PENDING": { label: "En attente de paiement", tone: "warn" }, "subscription.ACTIVE": { label: "Actif", tone: "ok" }, "subscription.EXPIRED": { label: "Expiré", tone: "neutral" }, "subscription.CANCELLED": { label: "Résilié", tone: "neutral" },
  // envois
  "delivery.SENT": { label: "Envoyé", tone: "ok" }, "delivery.FAILED": { label: "Échec", tone: "danger" }, "delivery.SKIPPED": { label: "Non envoyé", tone: "neutral" },
  "import.PENDING": { label: "À valider", tone: "warn" }, "import.VALIDATED": { label: "Validé", tone: "ok" }, "import.REJECTED": { label: "Rejeté", tone: "danger" },
};

export function StateBadge({ kind, value }: { kind: "order" | "payment" | "refund" | "approval" | "revision" | "ticket" | "subscription" | "delivery" | "import"; value: string }) {
  const meta = GENERIC[`${kind}.${value}`];
  return <Badge tone={meta?.tone ?? "neutral"} dot>{meta?.label ?? value}</Badge>;
}
