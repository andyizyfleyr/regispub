import Link from "next/link";
import { ArrowRight, CalendarDays, Wallet } from "lucide-react";
import { PlatformStack } from "@/components/icons";
import { CampaignStatusBadge } from "@/components/ui/badge";
import { campaignHref, type CampaignRowData } from "@/components/app/campaign-row";
import { PROGRESS_STEPS, progressIndex, STATUS_META, type CampaignStatusName } from "@/lib/campaigns/status";
import { getObjective } from "@/lib/catalog/objectives";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { cn, formatFcfa, formatPureDate } from "@/lib/utils";

export const WIZARD_STEPS = 4;

/** Carte de campagne : où elle en est, ce qu'il reste à faire, et le budget consommé quand elle est diffusée. */
const shortFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (d: Date | string) => shortFormat.format(new Date(d));

export function CampaignCard({ c, spend }: { c: CampaignRowData & { wizardStep?: number }; spend?: number }) {
  const objective = getObjective(c.objective);
  const status = c.status as CampaignStatusName;
  const meta = STATUS_META[status];
  const draft = status === "DRAFT";
  const expert = c.mode === "EXPERT";
  const live = status === "RUNNING" || status === "PAUSED" || status === "COMPLETED";
  const step = Math.min(WIZARD_STEPS, Math.max(1, c.wizardStep ?? 1));
  const index = progressIndex(status);
  const spentRatio = c.adBudget > 0 && spend !== undefined ? Math.min(1, spend / c.adBudget) : 0;

  return (
    <Link href={campaignHref(c)} className="lift group flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <PlatformStack platforms={c.platforms as PlatformCode[]} />
        <CampaignStatusBadge status={c.status} />
      </div>
      <p className="mt-4 truncate font-display text-[17px] font-semibold text-ink">{c.name}</p>
      <p className="mt-0.5 truncate text-[13.5px] text-muted">{objective?.label ?? "Objectif à définir"}</p>

      <div className="mt-4">
        {draft ? (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-sand"><div className="h-full origin-left animate-grow rounded-full bg-marigold" style={{ width: `${expert ? 35 : (step / WIZARD_STEPS) * 100}%` }} /></div>
            <p className="mt-2 text-[13px] text-muted">{expert ? "Brief à compléter" : `Étape ${step} sur ${WIZARD_STEPS}`}</p>
          </>
        ) : live && spend !== undefined && c.adBudget > 0 ? (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-sand"><div className="h-full origin-left animate-grow rounded-full bg-green" style={{ width: `${spentRatio * 100}%` }} /></div>
            <p className="tnum mt-2 text-[13px] text-muted"><span className="font-medium text-ink">{formatFcfa(spend)}</span> diffusés sur {formatFcfa(c.adBudget)}</p>
          </>
        ) : status === "CANCELLED" ? (
          <p className="text-[13px] text-muted">{meta.clientHint}</p>
        ) : (
          <>
            <div className="flex gap-1" aria-hidden>
              {PROGRESS_STEPS.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i < index ? "bg-green" : i === index ? "bg-marigold" : "bg-sand")} />)}
            </div>
            <p className="mt-2 line-clamp-1 text-[13px] text-muted">{meta.clientHint}</p>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5 text-[13px] text-muted">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {c.adBudget > 0 && <span className="tnum flex items-center gap-1.5"><Wallet className="size-3.5" />{formatFcfa(c.adBudget)}</span>}
          {c.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{shortDate(c.startDate)}{c.endDate ? ` → ${shortDate(c.endDate)}` : ""}</span>}
          {!c.adBudget && !c.startDate && <span>À compléter</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-medium text-green">
          {draft ? "Reprendre" : status === "PENDING_PAYMENT" ? "Payer" : "Ouvrir"}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
