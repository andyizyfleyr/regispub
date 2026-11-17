import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PlatformStack } from "@/components/icons";
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

/** Ligne de campagne : le nom, l'objectif et le budget à gauche, l'état à droite (sous le nom sur téléphone). */
export function CampaignRow({ c, base = "/app", extra }: { c: CampaignRowData; base?: string; extra?: React.ReactNode }) {
  const objective = getObjective(c.objective);
  return (
    <Link href={campaignHref(c, base)} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-paper sm:px-5">
      <PlatformStack platforms={c.platforms as PlatformCode[]} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{c.name}</p>
        <p className="truncate text-[13.5px] text-muted">
          {objective ? objectiveShort(objective) : "Objectif à définir"}
          {c.adBudget > 0 && <> · <span className="tnum">{formatFcfa(c.adBudget)}</span></>}
          {c.startDate && <span className="hidden sm:inline"> · {formatPureDate(c.startDate)}{c.endDate ? ` → ${formatPureDate(c.endDate)}` : ""}</span>}
        </p>
        <div className="mt-1.5 sm:hidden"><CampaignStatusBadge status={c.status} /></div>
        {extra}
      </div>
      <span className="hidden shrink-0 sm:block"><CampaignStatusBadge status={c.status} /></span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-line-strong transition-colors group-hover:text-muted" />
    </Link>
  );
}
