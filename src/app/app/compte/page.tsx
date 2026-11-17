import type { Metadata } from "next";
import { Building2, Gift, LifeBuoy } from "lucide-react";
import { BusinessDialog, CopyField, RedeemPoints } from "@/components/app/account-parts";
import { WhatsappIcon } from "@/components/icons";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Notice, PageHeader, Stat, TabsNav } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone, toWhatsappLink } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime, formatFcfa, formatNumber } from "@/lib/utils";
import { changePasswordAction, createTicketAction, deleteBusinessAction, updateProfileAction } from "@/server/actions/account";
import { subscribeAction } from "@/server/actions/payments";

export const metadata: Metadata = { title: "Mon compte" };

const TABS = ["profil", "entreprises", "fidelite", "abonnement", "support"] as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ onglet?: string; erreur?: string }> }) {
  const session = await requireUser();
  const { onglet, erreur } = await searchParams;
  const tab = (TABS as readonly string[]).includes(onglet ?? "") ? (onglet as (typeof TABS)[number]) : "profil";
  const [user, settings] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: session.id } }), getSettings()]);
  const base = "/app/compte";

  return (
    <>
      <PageHeader title="Mon compte" description={user.email} />
      <TabsNav current={tab} className="mb-6" tabs={[
        { id: "profil", label: "Profil", href: base },
        { id: "entreprises", label: "Entreprises", href: `${base}?onglet=entreprises` },
        { id: "fidelite", label: "Fidélité et parrainage", href: `${base}?onglet=fidelite` },
        { id: "abonnement", label: "Abonnement", href: `${base}?onglet=abonnement` },
        { id: "support", label: "Aide", href: `${base}?onglet=support` },
      ]} />

      {tab === "profil" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Informations personnelles" />
            <CardBody>
              <ActionForm action={updateProfileAction} className="space-y-4">
                <Field label="Nom complet" htmlFor="p-name"><Input id="p-name" name="name" required maxLength={80} defaultValue={user.name} autoComplete="name" /><FieldError name="name" /></Field>
                <Field label="Téléphone" htmlFor="p-phone" hint="Utilisé pour les notifications WhatsApp et proposé au paiement."><Input id="p-phone" name="phone" type="tel" inputMode="tel" required defaultValue={user.phone ? formatPhone(user.phone) : ""} autoComplete="tel" /><FieldError name="phone" /></Field>
                <Field label="Type de compte" htmlFor="p-type"><Select id="p-type" name="accountType" defaultValue={user.accountType}><option value="INDIVIDUAL">Particulier</option><option value="PROFESSIONAL">Professionnel</option></Select></Field>
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-[13px] font-medium text-ink-soft">Notifications</legend>
                  <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="notifyEmail" defaultChecked={user.notifyEmail} className="size-4 accent-forest" />Par e-mail</label>
                  <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="notifyWhatsapp" defaultChecked={user.notifyWhatsapp} className="size-4 accent-forest" />Par WhatsApp</label>
                  <p className="text-xs text-muted">Les notifications dans l&apos;application restent toujours actives. L&apos;envoi par e-mail et WhatsApp dépend des canaux activés sur la plateforme.</p>
                </fieldset>
                <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card className="self-start">
            <CardHeader title="Mot de passe" />
            <CardBody>
              <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
                <Field label="Mot de passe actuel" htmlFor="pw-cur"><Input id="pw-cur" name="current" type="password" required autoComplete="current-password" /><FieldError name="current" /></Field>
                <Field label="Nouveau mot de passe" htmlFor="pw-new" hint="10 caractères minimum, avec lettres et chiffres."><Input id="pw-new" name="password" type="password" required minLength={10} autoComplete="new-password" /><FieldError name="password" /></Field>
                <SubmitButton variant="outline" pendingLabel="Modification…">Modifier le mot de passe</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "entreprises" && <Businesses userId={user.id} />}
      {tab === "fidelite" && <Loyalty userId={user.id} points={user.loyaltyPoints} referralCode={user.referralCode} settings={settings} />}
      {tab === "abonnement" && <SubscriptionTab userId={user.id} error={erreur} />}
      {tab === "support" && <Support userId={user.id} whatsapp={settings.supportWhatsapp} email={settings.supportEmail} />}
    </>
  );
}

async function Businesses({ userId }: { userId: string }) {
  const list = await db.business.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, include: { _count: { select: { campaigns: true } } } });
  return (
    <Card>
      <CardHeader title="Mes entreprises" description="Gérez plusieurs activités depuis le même compte." action={<BusinessDialog />} />
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sand text-ink-soft"><Building2 className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{b.name}</p>
                <p className="truncate text-[13px] text-muted">{b.sector}{b.city ? ` · ${b.city}` : ""} · {b._count.campaigns} campagne{b._count.campaigns > 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-1">
                <BusinessDialog business={{ id: b.id, name: b.name, sector: b.sector, description: b.description, country: b.country, city: b.city, whatsapp: b.whatsapp, facebookUrl: b.facebookUrl, instagramUrl: b.instagramUrl, tiktokUrl: b.tiktokUrl, website: b.website }} />
                <ActionButton variant="ghost" size="sm" className="text-clay" action={deleteBusinessAction.bind(null, b.id)} confirm={`Supprimer « ${b.name} » ?`} successMessage="Entreprise supprimée.">Supprimer</ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Building2 />} title="Aucune entreprise" description="Ajoutez votre activité pour gagner du temps à chaque nouvelle campagne." />}
    </Card>
  );
}

async function Loyalty({ userId, points, referralCode, settings }: { userId: string; points: number; referralCode: string; settings: Awaited<ReturnType<typeof getSettings>> }) {
  const [entries, vouchers, referrals] = await Promise.all([
    db.loyaltyEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.promoCode.findMany({ where: { ownerId: userId, active: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.user.count({ where: { referredById: userId } }),
  ]);
  const link = `${env.appUrl}/inscription?parrain=${referralCode}`;
  const now = new Date();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Points de fidélité" value={formatNumber(points)} hint={`Valeur : ${formatFcfa(points * settings.loyaltyPointValue)}`} />
        <Stat label="Filleuls inscrits" value={formatNumber(referrals)} />
        <Stat label="Bons disponibles" value={formatNumber(vouchers.filter((v) => v.usedCount < (v.maxUses ?? Infinity) && (!v.endsAt || v.endsAt > now)).length)} className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Programme de fidélité" description={`${settings.loyaltyPointsPer1000} point par tranche de 1 000 F de frais de prestation payés. 1 point = ${formatFcfa(settings.loyaltyPointValue)}.`} />
          <CardBody><RedeemPoints balance={points} min={settings.loyaltyMinRedeem} pointValue={settings.loyaltyPointValue} /></CardBody>
          {entries.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate text-ink">{e.reason}</span><span className="text-xs text-muted">{formatDate(e.createdAt)}</span></span>
                  <span className={`tnum font-medium ${e.points < 0 ? "text-clay" : "text-green"}`}>{e.points > 0 ? "+" : ""}{formatNumber(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Parrainage" description={`Recevez un bon de ${formatFcfa(settings.referralReward)} au premier paiement de chaque filleul.`} />
            <CardBody className="space-y-3">
              <CopyField value={link} label="Lien de parrainage" />
              <p className="text-xs text-muted">Votre code : <span className="font-mono text-ink">{referralCode}</span>. Le bon est valable sur les frais de prestation, jamais sur le budget publicitaire.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Mes bons d'achat" />
            {vouchers.length ? (
              <ul className="divide-y divide-line">
                {vouchers.map((v) => {
                  const used = v.maxUses !== null && v.usedCount >= v.maxUses; const expired = Boolean(v.endsAt && v.endsAt < now);
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span><span className="font-mono text-ink">{v.code}</span><span className="block text-xs text-muted">{v.description ?? "Bon d'achat"}{v.endsAt ? ` · jusqu'au ${formatDate(v.endsAt)}` : ""}</span></span>
                      <span className="text-right"><span className="tnum block font-medium">{v.type === "PERCENT" ? `${v.value} %` : formatFcfa(v.value)}</span><span className="text-xs text-muted">{used ? "Utilisé" : expired ? "Expiré" : "Disponible"}</span></span>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState icon={<Gift />} title="Aucun bon" description="Convertissez vos points ou parrainez un proche pour en obtenir." />}
          </Card>
        </div>
      </div>
    </div>
  );
}

async function SubscriptionTab({ userId, error }: { userId: string; error?: string }) {
  const [plans, subs, businesses] = await Promise.all([
    db.service.findMany({ where: { kind: "SUBSCRIPTION", active: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, include: { business: { select: { name: true } }, orders: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } } } }),
    db.business.findMany({ where: { ownerId: userId }, select: { id: true, name: true } }),
  ]);
  const names = new Map(plans.map((p) => [p.code, p.name]));
  return (
    <div className="space-y-6">
      {error && <Notice tone="danger" title="Souscription impossible">{error}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <p className="mt-4"><span className="tnum font-display text-3xl font-semibold">{formatFcfa(p.fee)}</span><span className="text-sm text-muted"> / {p.periodDays ?? 30} jours</span></p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">{p.features.map((f) => <li key={f} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-green" />{f}</li>)}</ul>
              <form action={subscribeAction} className="mt-5 flex flex-wrap items-end gap-3">
                <input type="hidden" name="serviceCode" value={p.code} />
                {businesses.length > 0 && (
                  <Field label="Entreprise concernée" htmlFor={`sub-${p.id}`} className="min-w-48 flex-1"><Select id={`sub-${p.id}`} name="businessId" defaultValue={businesses[0]!.id}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
                )}
                <Button type="submit" variant="accent">Souscrire</Button>
              </form>
              <p className="mt-3 text-xs text-muted">Paiement par Mobile Money pour une période, sans prélèvement automatique : le renouvellement se fait à votre initiative. Le budget publicitaire n&apos;est pas inclus.</p>
            </CardBody>
          </Card>
        ))}
        {!plans.length && <Card><EmptyState title="Aucune formule disponible" description="Les formules d'accompagnement mensuel seront proposées ici." /></Card>}
      </div>
      {subs.length > 0 && (
        <Card>
          <CardHeader title="Mes abonnements" />
          <ul className="divide-y divide-line">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <span><span className="font-medium text-ink">{names.get(s.serviceCode) ?? s.serviceCode}</span><span className="block text-[13px] text-muted">{s.business?.name ?? "Toutes mes activités"}{s.periodEnd ? ` · jusqu'au ${formatDate(s.periodEnd)}` : ""}</span></span>
                <span className="flex items-center gap-3"><StateBadge kind="subscription" value={s.status} />{s.status === "PENDING" && s.orders[0]?.status === "PENDING" && <Button asChild size="sm" variant="outline"><a href={`/app/paiements/${s.orders[0].id}`}>Payer</a></Button>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

async function Support({ userId, whatsapp, email }: { userId: string; whatsapp: string; email: string }) {
  const [tickets, campaigns] = await Promise.all([
    db.ticket.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.campaign.findMany({ where: { userId, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, name: true } }),
  ]);
  const wa = whatsapp ? toWhatsappLink(whatsapp) : null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardHeader title="Mes demandes" description="Réclamations, questions de paiement et demandes de remboursement." />
        {tickets.length ? (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id} className="px-5 py-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">{t.subject}</p><StateBadge kind="ticket" value={t.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted"><span className="font-mono">{t.reference}</span> · {t.category} · {formatDateTime(t.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-ink-soft">{t.body}</p>
                {t.resolution && <p className="mt-2 rounded-md bg-green-soft px-3 py-2 text-[13px] text-forest">Réponse de l&apos;équipe : {t.resolution}</p>}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<LifeBuoy />} title="Aucune demande" description="Un problème ? Écrivez-nous avec le formulaire." />}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Nouvelle demande" />
          <CardBody>
            <ActionForm action={createTicketAction} resetOnSuccess className="space-y-4">
              <Field label="Catégorie" htmlFor="t-cat"><Select id="t-cat" name="category" defaultValue="Campagne">{["Paiement", "Remboursement", "Campagne", "Compte", "Autre"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
              {campaigns.length > 0 && <Field label="Campagne concernée" htmlFor="t-camp" optional><Select id="t-camp" name="campaignId" defaultValue=""><option value="">Aucune</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
              <Field label="Objet" htmlFor="t-sub"><Input id="t-sub" name="subject" required minLength={5} maxLength={120} /><FieldError name="subject" /></Field>
              <Field label="Votre message" htmlFor="t-body"><Textarea id="t-body" name="body" rows={5} required minLength={20} maxLength={3000} placeholder="Décrivez la situation. Pour un paiement, indiquez la référence de la commande." /><FieldError name="body" /></Field>
              <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        {(wa || email) && (
          <Card>
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium text-ink">Contact direct</p>
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-green hover:underline"><WhatsappIcon className="size-4" />WhatsApp {formatPhone(whatsapp)}</a>}
              {email && <a href={`mailto:${email}`} className="block text-green hover:underline">{email}</a>}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
