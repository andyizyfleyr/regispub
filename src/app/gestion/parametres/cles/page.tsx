import type { Metadata } from "next";
import Link from "next/link";
import { KeysForm } from "@/components/staff/keys-form";
import { FieldError } from "@/components/ui/action-form";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice, PageHeader, TabsNav } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getConfig, keysOverview, type KeyView } from "@/lib/config";
import { HOST_ONLY_KEYS, KEY_GROUPS, s3Complete, type KeyGroupId, type RuntimeConfig } from "@/lib/config/keys";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { saveKeysAction } from "@/server/actions/keys";

export const metadata: Metadata = { title: "Clés et connexions" };

/** Ce que les clés enregistrées permettent. C'est une lecture des réglages, pas un essai auprès du service. */
function groupState(id: KeyGroupId, c: RuntimeConfig): { tone: Tone; label: string } {
  switch (id) {
    case "payments":
      if (c.paymentProvider === "fedapay" && c.fedapaySecretKey) return { tone: "ok", label: c.fedapayEnv === "live" ? "FedaPay, mode réel" : "FedaPay, mode test" };
      if (c.paymentProvider === "sandbox" && (!env.isProd || c.allowSandboxPayments)) return { tone: "warn", label: "Simulation" };
      return { tone: "danger", label: "Aucun paiement possible" };
    case "storage":
      return c.storageDriver === "s3" && s3Complete(c) ? { tone: "ok", label: "Clés renseignées" } : { tone: "neutral", label: "À renseigner" };
    case "email":
      return c.emailProvider === "resend" && c.resendKey ? { tone: "ok", label: "Clés renseignées" } : { tone: "neutral", label: "Désactivé" };
    case "whatsapp":
      return c.whatsapp.phoneNumberId && c.whatsapp.accessToken && c.whatsapp.templateName ? { tone: "ok", label: "Clés renseignées" } : { tone: "neutral", label: "À renseigner" };
    case "ads": {
      const ready = [c.meta.accessToken ? "Meta" : null, c.tiktok.accessToken && c.tiktok.advertiserId ? "TikTok" : null].filter(Boolean);
      return ready.length ? { tone: "ok", label: `${ready.join(" et ")} : clés renseignées` } : { tone: "neutral", label: "À renseigner" };
    }
  }
}

/** D'où vient la valeur en vigueur. Une clé confidentielle n'est jamais affichée : seule sa fin est rappelée. */
function origin(k: KeyView): React.ReactNode {
  if (k.source === "unreadable") return <span className="text-clay">Valeur illisible : saisissez-la de nouveau.</span>;
  if (k.secret) {
    if (k.source === "admin") return <>Enregistrée ici <span className="tnum font-mono">{k.masked}</span></>;
    if (k.source === "host") return <>Valeur de Vercel <span className="tnum font-mono">{k.masked}</span></>;
    return "Non renseignée";
  }
  if (k.source === "admin") return "Réglé ici";
  if (k.source === "host") return "Valeur de Vercel";
  return null;
}

function KeyField({ k }: { k: KeyView }) {
  const id = `key-${k.name}`;
  const from = origin(k);
  const hint = k.hint || from ? <>{k.hint}{from && <span data-origin className={cn(k.hint && "block")}>{from}</span>}</> : undefined;
  return (
    <Field label={k.label} htmlFor={id} hint={hint}>
      {k.options ? (
        <Select id={id} name={k.name} defaultValue={k.value}>{k.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
      ) : k.secret ? (
        <Input id={id} name={k.name} defaultValue="" maxLength={2000} autoComplete="off" autoCapitalize="none" spellCheck={false} data-1p-ignore data-lpignore="true" className="font-mono"
          placeholder={k.masked ? "Coller une nouvelle clé pour la remplacer" : k.placeholder ?? "Coller la clé"} />
      ) : (
        <Input id={id} name={k.name} defaultValue={k.value} maxLength={2000} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={k.placeholder} />
      )}
      <FieldError name={k.name} />
      {k.secret && (k.source === "admin" || k.source === "unreadable") && (
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
          <Checkbox name="clear" value={k.name} aria-label={`Effacer : ${k.label}`} />Effacer cette clé
        </label>
      )}
    </Field>
  );
}

export default async function KeysPage() {
  const user = await requirePermission("keys.manage");
  const keys = await keysOverview();
  const config = await getConfig();
  const fromHost = keys.filter((k) => k.source === "host").length;
  const unreadable = keys.filter((k) => k.source === "unreadable").length;
  return (
    <>
      <PageHeader title="Paramètres" />
      {can(user.role, "settings.manage") && <TabsNav current="cles" tabs={[{ id: "reglages", label: "Réglages", href: "/gestion/parametres" }, { id: "cles", label: "Clés et connexions", href: "/gestion/parametres/cles" }]} />}

      <Notice tone="info" className="mb-5" title="Comment ça marche">
        Collez vos clés ici, puis « Enregistrer » : elles sont prises en compte en quelques secondes, sans redéployer le site. Une clé enregistrée est chiffrée et n&apos;est plus jamais affichée en entier.
        {fromHost > 0 && <> Les valeurs marquées « Valeur de Vercel » viennent encore de Vercel : une valeur saisie ici les remplace.</>}
      </Notice>
      {unreadable > 0 && (
        <Notice tone="danger" className="mb-5" title="Des clés sont à saisir de nouveau">
          {unreadable} clé{unreadable > 1 ? "s" : ""} enregistrée{unreadable > 1 ? "s" : ""} ici ne peu{unreadable > 1 ? "vent" : "t"} plus être lue{unreadable > 1 ? "s" : ""} : la clé de chiffrement du site (APP_SECRET) a changé.
        </Notice>
      )}

      <div className="space-y-6">
        {KEY_GROUPS.map((group) => {
          const items = keys.filter((k) => k.group === group.id);
          const state = groupState(group.id, config);
          // Le formulaire repart de zéro dès que l'état enregistré change (clé ajoutée, remplacée ou effacée).
          const version = items.map((k) => `${k.source}:${k.masked ?? k.value}`).join("|");
          return (
            <Card key={group.id} id={group.id} className="scroll-mt-24">
              <CardHeader title={group.title} description={group.description} action={<Badge tone={state.tone} dot>{state.label}</Badge>} className="flex-wrap" />
              <CardBody>
                <KeysForm key={version} action={saveKeysAction}>
                  <div className="grid gap-4 sm:grid-cols-2">{items.map((k) => <KeyField key={k.name} k={k} />)}</div>
                </KeysForm>
              </CardBody>
            </Card>
          );
        })}

        <Card>
          <CardHeader title="Ce qui reste chez Vercel" description="Trois réglages ne peuvent pas être saisis ici. Ils sont déjà en place : vous n'avez pas à y revenir." />
          <dl className="divide-y divide-line text-sm">
            {HOST_ONLY_KEYS.map((k) => (
              <div key={k.name} className="px-4 py-3 sm:px-5"><dt className="font-mono text-[0.8125rem] text-ink">{k.name}</dt><dd className="mt-0.5 text-[0.8125rem] text-ink-soft">{k.why}</dd></div>
            ))}
          </dl>
        </Card>

        {can(user.role, "integration.view") && (
          <p className="text-[0.84375rem] text-muted">Pour voir ce qui est actif sur le site : <Link href="/gestion/integrations" className="font-medium text-green underline-offset-4 hover:underline">Intégrations</Link>.</p>
        )}
      </div>
    </>
  );
}
