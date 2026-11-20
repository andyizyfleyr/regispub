import { PlatformBadge } from "@/components/icons";
import { DefinitionList } from "@/components/ui/misc";
import { getObjective } from "@/lib/catalog/objectives";
import { normalizeSplit, PLATFORMS, type PlatformCode } from "@/lib/catalog/platforms";
import { GENDERS, LANGUAGES, TARGET_COUNTRIES } from "@/lib/catalog/targeting";
import { readTargeting } from "@/lib/campaigns/editor-data";
import { formatPhone } from "@/lib/phone";
import { formatFcfa, formatPureDate } from "@/lib/utils";

type SummaryCampaign = {
  platforms: string[]; objective: string | null; productName: string | null; productDescription: string | null; productPrice: number | null; audienceNote: string | null;
  destinationWhatsapp: string | null; destinationUrl: string | null; brief: string | null; targeting: unknown; adBudget: number; budgetSplit: unknown;
  durationDays: number | null; startDate: Date | null; endDate: Date | null; mode: string; business?: { name: string; sector: string } | null;
};

/** Récapitulatif de la configuration d'une campagne (lecture seule). */
export function CampaignSummary({ c, compact }: { c: SummaryCampaign; compact?: boolean }) {
  const platforms = c.platforms as PlatformCode[];
  const objective = getObjective(c.objective);
  const t = readTargeting(c.targeting);
  const split = normalizeSplit(platforms, c.budgetSplit);
  const countries = t.countries.map((code) => TARGET_COUNTRIES.find((x) => x.code === code)?.name ?? code).join(", ");
  const gender = GENDERS.find((g) => g.id === t.gender)?.label ?? "Tous";
  const languages = t.languages.map((l) => LANGUAGES.find((x) => x.id === l)?.label ?? l).join(", ");
  return (
    <DefinitionList items={([
      { label: "Plateformes", value: <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{platforms.map((p) => <span key={p} className="flex items-center gap-1.5"><PlatformBadge platform={p} size="sm" />{PLATFORMS[p].label}{platforms.length > 1 && c.adBudget > 0 ? <span className="tnum text-muted">{split[p] ?? 0} %</span> : null}</span>)}</span> },
      { label: "Objectif", value: objective?.label },
      { label: "Entreprise", value: c.business ? `${c.business.name} · ${c.business.sector}` : null },
      ...(c.productName ? [{ label: "Produit ou service", value: `${c.productName}${c.productPrice ? ` — ${formatFcfa(c.productPrice)}` : ""}` }] : []),
      { label: "Budget publicitaire", value: c.adBudget ? <span className="tnum">{formatFcfa(c.adBudget)}{c.durationDays ? ` · ${formatFcfa(Math.floor(c.adBudget / c.durationDays))} / jour` : ""}</span> : null },
      { label: "Diffusion", value: c.startDate ? `${formatPureDate(c.startDate)}${c.endDate ? ` → ${formatPureDate(c.endDate)}` : ""}${c.durationDays ? ` (${c.durationDays} j)` : ""}` : c.durationDays ? `${c.durationDays} jours` : null },
      { label: "Zone", value: [countries, t.cities.join(", "), t.zoneNote].filter(Boolean).join(" · ") },
      { label: "Audience", value: `${gender}, ${t.ageMin}–${t.ageMax >= 65 ? "65+" : t.ageMax} ans${languages ? ` · ${languages}` : ""}` },
      // Plus proposés à la création : la ligne ne reste que pour les anciennes campagnes qui en avaient.
      ...(t.interests.length + t.categories.length ? [{ label: "Centres d'intérêt", value: [...t.interests, ...t.categories].join(", ") }] : []),
      { label: "Destination", value: [c.destinationWhatsapp ? `WhatsApp ${formatPhone(c.destinationWhatsapp)}` : null, c.destinationUrl].filter(Boolean).join(" · ") },
      ...(c.audienceNote ? [{ label: "Clientèle visée", value: c.audienceNote }] : []),
      ...(t.customAudience.requested ? [{ label: "Audience personnalisée", value: t.customAudience.note || "Demandée" }] : []),
      ...(c.productDescription ? [{ label: "Description", value: <span className="whitespace-pre-wrap">{c.productDescription}</span> }] : []),
      ...(c.brief ? [{ label: "Brief", value: <span className="whitespace-pre-wrap">{c.brief}</span> }] : []),
    ] as { label: string; value: React.ReactNode }[]).filter((it) => !compact || Boolean(it.value))} />
  );
}
