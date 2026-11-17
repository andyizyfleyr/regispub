import type { Metadata } from "next";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/auth/session";
import { loadSettings } from "@/lib/settings";
import type { PlatformSettings } from "@/lib/settings-schema";
import { saveSettingsAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Paramètres" };

type NumKey = { [K in keyof PlatformSettings]: PlatformSettings[K] extends number ? K : never }[keyof PlatformSettings];
type TextKey = Exclude<{ [K in keyof PlatformSettings]: PlatformSettings[K] extends string ? K : never }[keyof PlatformSettings], "paymentFeePayer">;

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const s = await loadSettings();
  const num = (key: NumKey, label: string, hint?: string, step = 1) => (
    <Field key={key} label={label} htmlFor={`set-${key}`} hint={hint}><Input id={`set-${key}`} name={key} type="number" inputMode="decimal" step={step} min={0} required className="tnum" defaultValue={s[key]} /><FieldError name={key} /></Field>
  );
  const text = (key: TextKey, label: string, hint?: string) => (
    <Field key={key} label={label} htmlFor={`set-${key}`} hint={hint} optional={key !== "companyName"}><Input id={`set-${key}`} name={key} maxLength={200} defaultValue={s[key]} /><FieldError name={key} /></Field>
  );
  return (
    <>
      <PageHeader title="Paramètres" />
      <ActionForm action={saveSettingsAction} className="space-y-6">
        <Card>
          <CardHeader title="Tarification" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {num("minServiceFee", "Frais de prestation minimum (F)", "Jamais inférieur à 10 000 F.", 500)}
            {num("extraPlatformFee", "Supplément par plateforme additionnelle (F)", "Meta (Facebook + Instagram) compte pour une plateforme.", 500)}
            {num("minAdBudget", "Budget publicitaire minimum (F)", undefined, 500)}
            {num("minDailyBudget", "Budget quotidien minimum (F)", undefined, 100)}
            {num("maxAdBudget", "Budget publicitaire maximum (F)", undefined, 1000)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paiement" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {num("paymentFeePercent", "Frais Mobile Money (%)", "Taux facturé par le prestataire de paiement.", 0.01)}
            <Field label="Frais Mobile Money à la charge" htmlFor="set-payer" hint="S'ils sont à la charge du client, ils apparaissent sur une ligne distincte du devis.">
              <Select id="set-payer" name="paymentFeePayer" defaultValue={s.paymentFeePayer}><option value="CLIENT">du client</option><option value="PLATFORM">de la plateforme</option></Select>
            </Field>
            {num("paymentExpiryMinutes", "Délai de validation d'un paiement (min)", "Au-delà, la demande expire et le client peut réessayer.")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Fidélité et parrainage" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {num("loyaltyPointsPer1000", "Points par 1 000 F de prestation", "0 désactive le programme.")}
            {num("loyaltyPointValue", "Valeur d'un point (F)")}
            {num("loyaltyMinRedeem", "Minimum convertible (points)")}
            {num("referralReward", "Bon de parrainage (F)", "0 désactive la récompense.", 500)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Entreprise et support" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {text("companyName", "Raison sociale")}
            {text("companyTaxId", "IFU / RCCM")}
            {text("companyAddress", "Adresse")}
            {text("supportEmail", "E-mail du support")}
            {text("supportWhatsapp", "WhatsApp du support", "Format international, par exemple +229 01 97 00 00 00.")}
            {text("agencyFacebookName", "Votre profil Facebook", "Nom exact. Les clients le cherchent pour vous ajouter à leur page.")}
          </CardBody>
        </Card>
        <SubmitButton size="lg" pendingLabel="Enregistrement…">Enregistrer les paramètres</SubmitButton>
      </ActionForm>
    </>
  );
}
