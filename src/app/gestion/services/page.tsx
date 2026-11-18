import type { Metadata } from "next";
import { PlatformBadge } from "@/components/icons";
import { ServiceDialog } from "@/components/staff/admin-panels";
import { BoostProductDialog } from "@/components/staff/boost-panels";
import { EyeOff } from "lucide-react";
import { ToneIcon } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader, Table } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { BOOST_KINDS, unitPriceLabel } from "@/lib/boost/catalog";
import { loadBoostProducts } from "@/lib/boost/service";
import { PLATFORM_CODES, PLATFORMS } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { effectiveMinFee } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { formatFcfa, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Prestations et tarifs" };

const KINDS: Record<string, { title: string; description: string }> = {
  CAMPAIGN: { title: "Campagnes par objectif", description: "Frais de prestation appliqués selon l'objectif choisi par le client." },
  PACK: { title: "Packs création + publicité", description: "Niveaux d'accompagnement avec création des visuels." },
  MANAGEMENT: { title: "Gestion complète", description: "Campagnes confiées à un expert." },
  SUBSCRIPTION: { title: "Abonnements", description: "Accompagnement mensuel, payé par période." },
};

export default async function ServicesPage() {
  await requirePermission("pricing.manage");
  const [services, settings, boosts] = await Promise.all([db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }), getSettings(), loadBoostProducts()]);
  const minFee = effectiveMinFee(settings);
  return (
    <>
      <PageHeader title="Prestations et tarifs" actions={<ServiceDialog minFee={minFee} />} />
      <Notice tone="info" className="mb-5" title={`Plancher : ${formatFcfa(minFee)}`}>Aucune prestation ne peut être facturée en dessous de ce montant, même après remise. Le plancher se règle dans les paramètres et ne descend jamais sous 10 000 F. Un changement de tarif ne modifie pas les commandes déjà passées.</Notice>
      <div className="space-y-6">
        {Object.entries(KINDS).map(([kind, meta]) => {
          const list = services.filter((s) => s.kind === kind);
          if (!list.length) return null;
          return (
            <Card key={kind}>
              <CardHeader title={meta.title} description={meta.description} />
              <Table head={["Prestation", "Code", "Frais", "État", ""]} mobileCorner={4}>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><span className="block font-medium text-ink">{s.name}</span><span className="block max-w-md text-xs text-muted">{s.description}</span></td>
                    <td className="font-mono text-xs text-muted">{s.code}</td>
                    <td className="tnum whitespace-nowrap font-medium">{formatFcfa(s.fee)}{s.periodDays ? <span className="font-normal text-muted"> / {s.periodDays} j</span> : null}</td>
                    <td><ToneIcon tone={s.active ? "ok" : "neutral"} label={s.active ? "Proposée" : "Masquée"} icon={s.active ? undefined : <EyeOff aria-hidden />} /></td>
                    <td className="text-right"><ServiceDialog minFee={minFee} service={{ id: s.id, code: s.code, name: s.name, description: s.description, kind: s.kind, fee: s.fee, periodDays: s.periodDays, features: s.features, active: s.active, sortOrder: s.sortOrder }} /></td>
                  </tr>
                ))}
              </Table>
            </Card>
          );
        })}
        {boosts.length > 0 && (
          <section id="abonnes" className="scroll-mt-20 space-y-6">
            <div className="px-1">
              <h2 className="font-display text-[1.125rem] font-semibold text-ink">Abonnés, J&apos;aime, commentaires, vues</h2>
              <p className="mt-0.5 text-[0.84375rem] text-muted">Vendus à la quantité. Le plancher des prestations ne s&apos;applique pas ici.</p>
            </div>
            {PLATFORM_CODES.map((platform) => {
              const list = boosts.filter((b) => b.platform === platform);
              if (!list.length) return null;
              return (
                <Card key={platform}>
                  <CardHeader title={PLATFORMS[platform].label} icon={<PlatformBadge platform={platform} size="md" />} />
                  <Table head={["Produit", "Packs", "Autre quantité", "État", ""]} mobileCorner={4}>
                    {list.map((b) => (
                      <tr key={b.id}>
                        <td><span className="block font-medium text-ink">{BOOST_KINDS[b.kind].label}</span>{b.delay ? <span className="block text-xs text-muted">Livraison sous {b.delay}</span> : null}</td>
                        <td data-empty={b.packs.length ? undefined : ""}>
                          {b.packs.length ? <span className="tnum flex flex-wrap gap-x-3 gap-y-0.5 text-[0.8125rem] max-sm:justify-end">{b.packs.map((p) => <span key={p.quantity} className="whitespace-nowrap">{formatNumber(p.quantity)} : <span className="font-medium text-ink">{formatFcfa(p.price)}</span></span>)}</span> : "—"}
                        </td>
                        <td className="tnum text-[0.8125rem]"><span className="block whitespace-nowrap font-medium text-ink">{unitPriceLabel(b)}</span><span className="block whitespace-nowrap text-xs text-muted">de {formatNumber(b.minQuantity)} à {formatNumber(b.maxQuantity)}</span></td>
                        <td><ToneIcon tone={b.active ? "ok" : "neutral"} label={b.active ? "Proposé" : "Masqué"} icon={b.active ? undefined : <EyeOff aria-hidden />} /></td>
                        <td className="text-right"><BoostProductDialog product={b} /></td>
                      </tr>
                    ))}
                  </Table>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
