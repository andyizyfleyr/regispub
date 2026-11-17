import type { Metadata } from "next";
import { FilterChips } from "@/components/staff/common";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Table } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatFcfa } from "@/lib/utils";
import { savePromoAction, togglePromoAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Codes promotionnels" };

export default async function PromosPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requirePermission("promo.manage");
  const { vue } = await searchParams;
  const personal = vue === "bons";
  const promos = await db.promoCode.findMany({ where: { source: personal ? { not: "ADMIN" } : "ADMIN" }, orderBy: { createdAt: "desc" }, take: 100, include: { owner: { select: { name: true } } } });
  const now = new Date();
  return (
    <>
      <PageHeader title="Codes promotionnels" />
      <div className="mb-4"><FilterChips current={personal ? "bons" : "codes"} items={[{ id: "codes", label: "Codes de campagne", href: "/gestion/promos" }, { id: "bons", label: "Bons fidélité et parrainage", href: "/gestion/promos?vue=bons" }]} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 self-start">
          {promos.length ? (
            <Table head={["Code", "Remise", "Utilisations", "Validité", "État", ""]} mobileCorner={5}>
              {promos.map((p) => {
                const expired = Boolean(p.endsAt && p.endsAt < now); const exhausted = p.maxUses !== null && p.usedCount >= p.maxUses;
                return (
                  <tr key={p.id}>
                    <td><span className="block font-mono text-[0.8125rem] font-medium text-ink">{p.code}</span><span className="block max-w-56 truncate text-xs text-muted">{p.owner ? `Bon de ${p.owner.name}` : p.description ?? ""}</span></td>
                    <td className="tnum whitespace-nowrap">{p.type === "PERCENT" ? `${p.value} %` : formatFcfa(p.value)}{p.minServiceFee ? <span className="block text-xs text-muted">dès {formatFcfa(p.minServiceFee)}</span> : null}</td>
                    <td className="tnum">{p.usedCount}{p.maxUses !== null ? ` / ${p.maxUses}` : ""}</td>
                    <td className="whitespace-nowrap text-[0.8125rem] text-muted">{p.startsAt ? `du ${formatDate(p.startsAt)} ` : ""}{p.endsAt ? `au ${formatDate(p.endsAt)}` : "Sans limite"}</td>
                    <td><Badge tone={!p.active ? "neutral" : expired || exhausted ? "warn" : "ok"}>{!p.active ? "Désactivé" : expired ? "Expiré" : exhausted ? "Épuisé" : "Actif"}</Badge></td>
                    <td className="text-right"><ActionButton variant="ghost" size="sm" action={togglePromoAction.bind(null, p.id)} successMessage={p.active ? "Code désactivé." : "Code réactivé."}>{p.active ? "Désactiver" : "Réactiver"}</ActionButton></td>
                  </tr>
                );
              })}
            </Table>
          ) : <EmptyState title="Aucun code" description={personal ? "Les bons générés par la fidélité et le parrainage apparaissent ici." : "Créez un premier code avec le formulaire."} />}
        </Card>
        {!personal && (
          <Card className="self-start">
            <CardHeader title="Nouveau code" />
            <CardBody>
              <ActionForm action={savePromoAction} resetOnSuccess className="space-y-4">
                <Field label="Code" htmlFor="pr-code"><Input id="pr-code" name="code" required maxLength={24} className="font-mono uppercase" placeholder="RENTREE15" /><FieldError name="code" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type" htmlFor="pr-type"><Select id="pr-type" name="type" defaultValue="PERCENT"><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe (F)</option></Select></Field>
                  <Field label="Valeur" htmlFor="pr-value"><Input id="pr-value" name="value" type="number" inputMode="numeric" min={1} required className="tnum" /><FieldError name="value" /></Field>
                  <Field label="Utilisations max." htmlFor="pr-max" optional><Input id="pr-max" name="maxUses" type="number" min={1} className="tnum" /></Field>
                  <Field label="Par client" htmlFor="pr-per"><Input id="pr-per" name="perUserLimit" type="number" min={1} defaultValue={1} className="tnum" /></Field>
                  <Field label="Début" htmlFor="pr-start" optional><DatePicker id="pr-start" name="startsAt" /></Field>
                  <Field label="Fin" htmlFor="pr-end" optional><DatePicker id="pr-end" name="endsAt" /><FieldError name="endsAt" /></Field>
                </div>
                <p className="text-xs text-muted">Après remise, les frais de prestation ne descendent jamais sous le plancher de la plateforme.</p>
                <SubmitButton pendingLabel="Création…">Créer le code</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
