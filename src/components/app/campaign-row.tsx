import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PlatformAvatar } from "@/components/icons";
import { CampaignStatusBadge } from "@/components/ui/badge";
import { getObjective, objectiveShort } from "@/lib/catalog/objectives";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { formatFcfa, formatPureDate } from "@/lib/utils";

export type CampaignRowData = {
  id: string; name: string; reference: string; status: string; mode: string; platforms: string[]; objective: string | null;
  adBudget: number; startDate: Date | null; endDate: Date | null; updatedAt: Date;
};

export function campaignHref(c: { id: string; status: string; mode: string }, base = "/app") {
  if (base !== "/app") return `${base}/campagnes/${c.id}`;
  if (c.status === "DRAFT") return c.mode === "EXPERT" ? `/app/expert/${c.id}` : `/app/creer/${c.id}`;
  return `/app/campagnes/${c.id}`;
}

/**
 * Ligne de campagne, identique sur toutes les listes : une vignette des réseaux, puis le nom et le budget
 * sur la première ligne, l'objectif et l'état sur la seconde. Tout commence et finit aux mêmes endroits.
 */
export function CampaignRow({ c, base = "/app", extra }: { c: CampaignRowData; base?: string; extra?: React.ReactNode }) {
  const objective = getObjective(c.objective);
  return (
    <Link href={campaignHref(c, base)} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-paper sm:px-5">
      <PlatformAvatar platforms={c.platforms as PlatformCode[]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate font-semibold leading-snug text-ink">{c.name}</p>
          {c.adBudget > 0 && <span className="tnum shrink-0 text-sm font-semibold text-ink">{formatFcfa(c.adBudget)}</span>}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[13.5px] leading-snug text-muted">
            {objective ? objectiveShort(objective) : c.mode === "EXPERT" ? "Confiée à un expert" : "Objectif à définir"}
            {c.startDate && <span className="hidden sm:inline"> · {formatPureDate(c.startDate)}{c.endDate ? ` → ${formatPureDate(c.endDate)}` : ""}</span>}
          </p>
          <span className="shrink-0"><CampaignStatusBadge status={c.status} short /></span>
        </div>
        {extra && <div className="mt-1 truncate leading-snug">{extra}</div>}
      </div>
      <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-line-strong transition-colors group-hover:text-muted sm:block" />
    </Link>
  );
}
