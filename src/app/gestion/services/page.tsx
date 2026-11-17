import type { Metadata } from "next";
import { ServiceDialog } from "@/components/staff/admin-panels";
import { EyeOff } from "lucide-react";
import { ToneIcon } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader, Table } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { effectiveMinFee } from "@/lib/pricing/quote";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Prestations et tarifs" };

const KINDS: Record<string, { title: string; description: string }> = {
  CAMPAIGN: { title: "Campagnes par objectif", description: "Frais de prestation appliqués selon l'objectif choisi par le client." },
  PACK: { title: "Packs création + publicité", description: "Niveaux d'accompagnement avec création des visuels." },
  MANAGEMENT: { title: "Gestion complète", description: "Campagnes confiées à un expert." },
  SUBSCRIPTION: { title: "Abonnements", description: "Accompagnement mensuel, payé par période." },
};

export default async function ServicesPage() {
  await requirePermission("pricing.manage");
  const [services, settings] = await Promise.all([db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }), getSettings()]);
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
      </div>
    </>
  );
}
