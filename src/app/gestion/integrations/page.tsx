import type { Metadata } from "next";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { integrationsStatus, STATE_LABELS, type IntegrationState } from "@/lib/integrations";

export const metadata: Metadata = { title: "Intégrations" };

const TONES: Record<IntegrationState, Tone> = { operational: "ok", simulation: "warn", needs_config: "neutral", needs_authorization: "info", planned: "neutral" };

export default async function IntegrationsPage() {
  await requirePermission("integration.view");
  const items = integrationsStatus();
  const areas = Array.from(new Set(items.map((i) => i.area)));
  return (
    <>
      <PageHeader title="Intégrations" />
      <Notice tone="info" className="mb-5" title="Lecture de cette page">
        « Opérationnel » : configuré et utilisé. « Simulation » : aucun échange réel. « À configurer » : le code est prêt, il manque des clés. « Autorisation requise » : dépend d&apos;une validation de Meta, TikTok ou WhatsApp sur vos comptes. « En attente » : non proposé pour l&apos;instant. Les clés se définissent dans les variables d&apos;environnement de l&apos;hébergement, jamais dans cette interface.
      </Notice>
      <div className="space-y-6">
        {areas.map((area) => (
          <Card key={area}>
            <CardHeader title={area} />
            <ul className="divide-y divide-line">
              {items.filter((i) => i.area === area).map((i) => (
                <li key={i.name} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 sm:px-5 py-4">
                  <div className="min-w-0 flex-1 basis-80">
                    <p className="text-sm font-medium text-ink">{i.name}</p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">{i.detail}</p>
                    {i.action && <p className="mt-1.5 text-[13px] text-muted"><span className="font-medium text-ink-soft">Pour l&apos;activer :</span> {i.action}</p>}
                  </div>
                  <Badge tone={TONES[i.state]} dot>{STATE_LABELS[i.state]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card>
          <CardHeader title="Points d'entrée techniques" />
          <dl className="divide-y divide-line text-sm">
            {[
              ["Webhook FedaPay", `${env.appUrl}/api/webhooks/payments/fedapay`],
              ["Tâche planifiée quotidienne", `${env.appUrl}/api/cron/quotidien`],
              ["Vérification des paiements en attente", `${env.appUrl}/api/cron/paiements`],
              ["État du service", `${env.appUrl}/api/health`],
            ].map(([label, url]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 sm:px-5 py-3"><dt className="text-ink-soft">{label}</dt><dd className="break-all font-mono text-[13px] text-ink">{url}</dd></div>
            ))}
          </dl>
          <p className="border-t border-line px-4 sm:px-5 py-3 text-xs text-muted">Les tâches planifiées exigent l&apos;en-tête <span className="font-mono">Authorization: Bearer CRON_SECRET</span>.</p>
        </Card>
      </div>
    </>
  );
}
