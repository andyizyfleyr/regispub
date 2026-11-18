import * as React from "react";
import { BadgeCheck, Ban, Check, Clock, Ellipsis, Hourglass, ImageIcon, Lock, MessageSquareText, Minus, Paperclip, Pause, PencilLine, Play, Rocket, Send, TimerOff, TriangleAlert, Undo2, Wallet, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { StatusIcon } from "./status-icon";
import { TONES, type Tone } from "./tones";

export { type Tone } from "./tones";

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

const STATUS_ICONS: Record<CampaignStatusName, LucideIcon> = {
  DRAFT: PencilLine, PENDING_PAYMENT: Wallet, PAID: BadgeCheck, AWAITING_INFO: MessageSquareText, IN_PREPARATION: Hourglass, CLIENT_REVIEW: ImageIcon,
  READY_TO_LAUNCH: Rocket, RUNNING: Play, PAUSED: Pause, COMPLETED: Check, CANCELLED: X,
};

/** État d'une campagne : pastille ronde colorée, sans texte. Le libellé s'ouvre au survol ou à l'appui long. */
export function CampaignStatusIcon({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status as CampaignStatusName];
  const Icon = STATUS_ICONS[status as CampaignStatusName] ?? PencilLine;
  return <StatusIcon label={meta?.label ?? status} tone={meta?.tone ?? "neutral"} className={className}><Icon aria-hidden /></StatusIcon>;
}

type StateKind = "order" | "payment" | "refund" | "approval" | "revision" | "ticket" | "subscription" | "delivery" | "import" | "boost";

const GENERIC: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  // commandes
  "order.PENDING": { label: "À régler", tone: "warn", icon: Wallet }, "order.PAID": { label: "Payée", tone: "ok", icon: Check }, "order.CANCELLED": { label: "Annulée", tone: "neutral", icon: X },
  "order.EXPIRED": { label: "Expirée", tone: "neutral", icon: TimerOff }, "order.PARTIALLY_REFUNDED": { label: "Remboursée en partie", tone: "info", icon: Undo2 }, "order.REFUNDED": { label: "Remboursée", tone: "info", icon: Undo2 },
  // paiements
  "payment.INITIATED": { label: "Initié", tone: "neutral", icon: Ellipsis }, "payment.PENDING": { label: "En attente de validation", tone: "warn", icon: Clock }, "payment.SUCCEEDED": { label: "Confirmé", tone: "ok", icon: Check },
  "payment.FAILED": { label: "Échoué", tone: "danger", icon: TriangleAlert }, "payment.CANCELLED": { label: "Annulé", tone: "neutral", icon: X }, "payment.EXPIRED": { label: "Expiré", tone: "neutral", icon: TimerOff },
  // remboursements
  "refund.REQUESTED": { label: "À traiter", tone: "warn", icon: Clock }, "refund.PROCESSED": { label: "Effectué", tone: "ok", icon: Check }, "refund.REJECTED": { label: "Refusé", tone: "danger", icon: X },
  // validation des créations
  "approval.NOT_REQUIRED": { label: "Fourni", tone: "neutral", icon: Paperclip }, "approval.PENDING": { label: "À valider", tone: "warn", icon: Clock }, "approval.APPROVED": { label: "Validé", tone: "ok", icon: Check }, "approval.CHANGES_REQUESTED": { label: "Modifications demandées", tone: "danger", icon: PencilLine },
  // demandes de modification
  "revision.OPEN": { label: "Ouverte", tone: "warn", icon: Clock }, "revision.IN_PROGRESS": { label: "En cours", tone: "info", icon: Hourglass }, "revision.DONE": { label: "Traitée", tone: "ok", icon: Check }, "revision.REJECTED": { label: "Refusée", tone: "danger", icon: X },
  // réclamations
  "ticket.OPEN": { label: "Ouverte", tone: "warn", icon: MessageSquareText }, "ticket.IN_PROGRESS": { label: "En cours", tone: "info", icon: Hourglass }, "ticket.RESOLVED": { label: "Résolue", tone: "ok", icon: Check }, "ticket.CLOSED": { label: "Clôturée", tone: "neutral", icon: Lock },
  // abonnements
  "subscription.PENDING": { label: "En attente de paiement", tone: "warn", icon: Wallet }, "subscription.ACTIVE": { label: "Actif", tone: "ok", icon: Check }, "subscription.EXPIRED": { label: "Expiré", tone: "neutral", icon: TimerOff }, "subscription.CANCELLED": { label: "Résilié", tone: "neutral", icon: X },
  // livraison des commandes d'abonnés, de J'aime, de commentaires et de vues
  "boost.AWAITING_PAYMENT": { label: "À régler", tone: "warn", icon: Wallet }, "boost.TO_DELIVER": { label: "Payée, à livrer", tone: "info", icon: Clock }, "boost.IN_PROGRESS": { label: "Livraison en cours", tone: "info", icon: Rocket },
  "boost.DELIVERED": { label: "Livrée", tone: "ok", icon: Check }, "boost.CANCELLED": { label: "Annulée", tone: "neutral", icon: X },
  // envois
  "delivery.SENT": { label: "Envoyé", tone: "ok", icon: Send }, "delivery.FAILED": { label: "Échec", tone: "danger", icon: TriangleAlert }, "delivery.SKIPPED": { label: "Non envoyé", tone: "neutral", icon: Minus },
  "import.PENDING": { label: "À valider", tone: "warn", icon: Clock }, "import.VALIDATED": { label: "Validé", tone: "ok", icon: Check }, "import.REJECTED": { label: "Rejeté", tone: "danger", icon: X },
};

/** État d'une commande, d'un paiement, d'une demande… : pastille ronde colorée, libellé dans la bulle. */
export function StateIcon({ kind, value, className }: { kind: StateKind; value: string; className?: string }) {
  const meta = GENERIC[`${kind}.${value}`];
  const Icon = meta?.icon ?? Minus;
  return <StatusIcon label={meta?.label ?? value} tone={meta?.tone ?? "neutral"} className={className}><Icon aria-hidden /></StatusIcon>;
}

const TONE_ICONS: Record<Tone, LucideIcon> = { neutral: Minus, warn: Clock, info: Hourglass, ok: Check, danger: Ban, accent: Check };

/** Pastille d'état libre : la couleur choisit le pictogramme, sauf si `icon` en fournit un. */
export function ToneIcon({ tone = "neutral", label, icon, className }: { tone?: Tone; label: string; icon?: React.ReactNode; className?: string }) {
  const Icon = TONE_ICONS[tone];
  return <StatusIcon label={label} tone={tone} className={className}>{icon ?? <Icon aria-hidden />}</StatusIcon>;
}
