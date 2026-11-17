import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PlatformStack } from "@/components/icons";
import { CampaignStatusBadge } from "@/components/ui/badge";
import { getObjective } from "@/lib/catalog/objectives";
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

export function CampaignRow({ c, base = "/app", extra }: { c: CampaignRowData; base?: string; extra?: React.ReactNode }) {
  const objective = getObjective(c.objective);
  return (
    <Link href={campaignHref(c, base)} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-paper sm:px-5">
      <PlatformStack platforms={c.platforms as PlatformCode[]} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{c.name}</p>
        <p className="truncate text-[13px] text-muted">
          {objective?.label ?? "Objectif à définir"}
          {c.adBudget > 0 && <> · <span className="tnum">{formatFcfa(c.adBudget)}</span> de budget</>}
          {c.startDate && <> · {formatPureDate(c.startDate)}{c.endDate ? ` → ${formatPureDate(c.endDate)}` : ""}</>}
        </p>
        {extra}
      </div>
      <CampaignStatusBadge status={c.status} />
      <ChevronRight className="hidden size-4 text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:block" />
    </Link>
  );
}
