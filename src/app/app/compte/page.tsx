import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, Building2, CalendarClock, Check, Gift, LifeBuoy, LogOut, Mail, Star, Ticket, UserRound, Users } from "lucide-react";
import { BusinessDialog, CopyField, RedeemPoints } from "@/components/app/account-parts";
import { WhatsappIcon } from "@/components/icons";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { StateBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { List, ListRow } from "@/components/ui/list";
import { StatTile } from "@/components/ui/tile";
import { Switch, ToggleRow } from "@/components/ui/controls";
import { EmptyState, Notice, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone, toWhatsappLink } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime, formatFcfa, formatNumber, initials } from "@/lib/utils";
import { changePasswordAction, createTicketAction, deleteBusinessAction, updateProfileAction } from "@/server/actions/account";
import { logoutAction } from "@/server/actions/auth";
import { subscribeAction } from "@/server/actions/payments";

export const metadata: Metadata = { title: "Mon compte" };

const TABS = ["profil", "entreprises", "fidelite", "abonnement", "support"] as const;
const MENU: Record<(typeof TABS)[number], { label: string; hint: string; icon: typeof Gift; tone: "green" | "marigold" | "sky" | "violet" | "rose" }> = {
  profil: { label: "Profil", hint: "Nom, téléphone, mot de passe", icon: UserRound, tone: "green" },
  entreprises: { label: "Entreprises", hint: "Vos pages et comptes", icon: Building2, tone: "marigold" },
  fidelite: { label: "Fidélité", hint: "Points, parrainage, bons", icon: Gift, tone: "sky" },
  abonnement: { label: "Abonnement", hint: "Accompagnement mensuel", icon: CalendarClock, tone: "violet" },
  support: { label: "Aide", hint: "Une question, un problème", icon: LifeBuoy, tone: "rose" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ onglet?: string; erreur?: string }> }) {
  const session = await requireUser();
  const { onglet, erreur } = await searchParams;
  const asked = onglet === "aide" ? "support" : onglet;
  const tab = (TABS as readonly string[]).includes(asked ?? "") ? (asked as (typeof TABS)[number]) : null;
  const [user, settings] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: session.id } }), getSettings()]);
  const base = "/app/compte";

  if (!tab) {
    const rows = [...TABS.map((id) => ({ href: `${base}?onglet=${id}`, ...MENU[id] })), { href: "/app/notifications", label: "Notifications", icon: Bell, hint: "Vos messages", tone: "neutral" as const }];
    return (
      <>
        <section className="mb-6 flex animate-rise items-center gap-4 rounded-xl border border-line/70 bg-surface p-4 shadow-card sm:p-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#0b2a1f,#0b7a53)] font-display text-[22px] font-semibold text-white">{initials(user.name)}</span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold leading-tight">{user.name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
          </div>
        </section>
        <List>
          {rows.map((r) => <ListRow key={r.href} href={r.href} icon={<r.icon />} tone={r.tone} title={r.label} subtitle={r.hint} />)}
        </List>
        <form action={logoutAction} className="mt-6"><Button type="submit" variant="outline" size="lg" className="w-full text-clay"><LogOut />Se déconnecter</Button></form>
      </>
    );
  }

  return (
    <>
      <PageHeader title={MENU[tab].label} back={{ href: base, label: "Compte" }} />

      {tab === "profil" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Mes informations" />
            <CardBody>
              <ActionForm action={updateProfileAction} className="space-y-4">
                <Field label="Nom complet" htmlFor="p-name"><Input id="p-name" name="name" required maxLength={80} defaultValue={user.name} autoComplete="name" /><FieldError name="name" /></Field>
                <Field label="Téléphone" htmlFor="p-phone"><Input id="p-phone" name="phone" type="tel" inputMode="tel" required defaultValue={user.phone ? formatPhone(user.phone) : ""} autoComplete="tel" /><FieldError name="phone" /></Field>
                <fieldset className="space-y-2">
                  <legend className="mb-1.5 text-[13px] font-medium text-ink">Notifications</legend>
                  <ToggleRow icon={<Mail />} label="E-mail" htmlFor="p-nmail"><Switch id="p-nmail" name="notifyEmail" defaultChecked={user.notifyEmail} /></ToggleRow>
                  <ToggleRow icon={<WhatsappIcon />} label="WhatsApp" htmlFor="p-nwa"><Switch id="p-nwa" name="notifyWhatsapp" defaultChecked={user.notifyWhatsapp} /></ToggleRow>
                </fieldset>
                <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Mot de passe" />
            <CardBody>
              <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
                <Field label="Mot de passe actuel" htmlFor="pw-cur"><Input id="pw-cur" name="current" type="password" required autoComplete="current-password" /><FieldError name="current" /></Field>
                <Field label="Nouveau mot de passe" htmlFor="pw-new" hint="10 caractères, lettres et chiffres."><Input id="pw-new" name="password" type="password" required minLength={10} autoComplete="new-password" /><FieldError name="password" /></Field>
                <SubmitButton variant="outline" pendingLabel="Modification…">Modifier</SubmitButton>
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
      <CardHeader title="Mes entreprises" action={<BusinessDialog />} />
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sand text-ink-soft"><Building2 className="size-5" /></span>
              <div className="min-w-[11rem] flex-1">
                <p className="truncate font-medium text-ink">{b.name}</p>
                <p className="truncate text-[13px] text-muted">{b.sector}{b.city ? ` · ${b.city}` : ""} · {b._count.campaigns} campagne{b._count.campaigns > 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-1 max-sm:-my-1 max-sm:w-full max-sm:justify-end">
                <BusinessDialog business={{ id: b.id, name: b.name, sector: b.sector, description: b.description, country: b.country, city: b.city, whatsapp: b.whatsapp, facebookUrl: b.facebookUrl, instagramUrl: b.instagramUrl, tiktokUrl: b.tiktokUrl, website: b.website }} />
                <ActionButton variant="ghost" size="sm" className="text-clay" action={deleteBusinessAction.bind(null, b.id)} confirm={`Supprimer « ${b.name} » ?`} successMessage="Entreprise supprimée.">Supprimer</ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Building2 />} title="Aucune entreprise" />}
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
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Points" value={formatNumber(points)} hint={`= ${formatFcfa(points * settings.loyaltyPointValue)}`} icon={<Star />} tone="marigold" />
        <StatTile label="Filleuls" value={formatNumber(referrals)} icon={<Users />} tone="sky" />
        <StatTile label="Bons" value={formatNumber(vouchers.filter((v) => v.usedCount < (v.maxUses ?? Infinity) && (!v.endsAt || v.endsAt > now)).length)} icon={<Ticket />} tone="violet" />
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Mes points" description={`${settings.loyaltyPointsPer1000} point par 1 000 F de prestation. 1 point = ${formatFcfa(settings.loyaltyPointValue)}.`} />
          <CardBody><RedeemPoints balance={points} min={settings.loyaltyMinRedeem} pointValue={settings.loyaltyPointValue} /></CardBody>
          {entries.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate text-ink">{e.reason}</span><span className="text-xs text-muted">{formatDate(e.createdAt)}</span></span>
                  <span className={`tnum font-medium ${e.points < 0 ? "text-clay" : "text-green"}`}>{e.points > 0 ? "+" : ""}{formatNumber(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Parrainage" description={`${formatFcfa(settings.referralReward)} offerts par filleul qui paie.`} />
            <CardBody className="space-y-3">
              <CopyField value={link} label="Lien de parrainage" />
              <p className="text-xs text-muted">Code : <span className="font-mono text-ink">{referralCode}</span> · valable sur la prestation.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Mes bons" />
            {vouchers.length ? (
              <ul className="divide-y divide-line">
                {vouchers.map((v) => {
                  const used = v.maxUses !== null && v.usedCount >= v.maxUses; const expired = Boolean(v.endsAt && v.endsAt < now);
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-sm">
                      <span><span className="font-mono text-ink">{v.code}</span><span className="block text-xs text-muted">{v.description ?? "Bon d'achat"}{v.endsAt ? ` · jusqu'au ${formatDate(v.endsAt)}` : ""}</span></span>
                      <span className="text-right"><span className="tnum block font-medium">{v.type === "PERCENT" ? `${v.value} %` : formatFcfa(v.value)}</span><span className="text-xs text-muted">{used ? "Utilisé" : expired ? "Expiré" : "Disponible"}</span></span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 sm:px-5 py-4 text-sm text-muted">Aucun bon pour l&apos;instant.</p>}
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
      {error && <Notice tone="danger" title="Impossible">{error}</Notice>}
      <div className="space-y-4">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-4"><span className="tnum font-display text-3xl font-semibold">{formatFcfa(p.fee)}</span><span className="text-sm text-muted"> / {p.periodDays ?? 30} jours</span></p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">{p.features.slice(0, 4).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green" />{f}</li>)}</ul>
              <form action={subscribeAction} className="mt-5 flex flex-wrap items-end gap-3">
                <input type="hidden" name="serviceCode" value={p.code} />
                {businesses.length === 1 && <input type="hidden" name="businessId" value={businesses[0]!.id} />}
                {businesses.length > 1 && (
                  <Field label="Entreprise" htmlFor={`sub-${p.id}`} className="min-w-48 flex-1"><Select id={`sub-${p.id}`} name="businessId" defaultValue={businesses[0]!.id}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
                )}
                <Button type="submit" variant="accent">Souscrire</Button>
              </form>
              <p className="mt-3 text-xs text-muted">Sans prélèvement automatique. Hors budget publicitaire.</p>
            </CardBody>
          </Card>
        ))}
        {!plans.length && <Card><EmptyState title="Aucune formule" /></Card>}
      </div>
      {subs.length > 0 && (
        <Card>
          <CardHeader title="Mes abonnements" />
          <ul className="divide-y divide-line">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-sm">
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
  const tickets = await db.ticket.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  const wa = whatsapp ? toWhatsappLink(whatsapp) : null;
  return (
    <div className="flex flex-col gap-6">
      <Card className="order-2">
        <CardHeader title="Mes demandes" />
        {tickets.length ? (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id} className="px-4 sm:px-5 py-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">{t.subject}</p><StateBadge kind="ticket" value={t.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted"><span className="font-mono">{t.reference}</span> · {t.category} · {formatDateTime(t.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-ink-soft">{t.body}</p>
                {t.resolution && <p className="mt-2 rounded-md bg-green-soft px-3 py-2 text-[13px] text-forest">Réponse : {t.resolution}</p>}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<LifeBuoy />} title="Aucune demande" />}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Nouvelle demande" />
          <CardBody>
            <ActionForm action={createTicketAction} resetOnSuccess className="space-y-4">
              <Field label="Catégorie" htmlFor="t-cat"><Select id="t-cat" name="category" defaultValue="Campagne">{["Paiement", "Remboursement", "Campagne", "Compte", "Autre"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Message" htmlFor="t-body"><Textarea id="t-body" name="body" rows={5} required minLength={20} maxLength={3000} placeholder="Pour un paiement, indiquez la référence." /><FieldError name="body" /></Field>
              <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        {(wa || email) && (
          <Card>
            <CardBody className="space-y-2 text-sm">
              <Link href="/app?guide=1" className="flex items-center gap-2 font-medium text-green hover:underline"><BookOpen className="size-4" />Revoir le guide</Link>
              <p className="pt-2 font-medium text-ink">Contact</p>
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-green hover:underline"><WhatsappIcon className="size-4" />WhatsApp {formatPhone(whatsapp)}</a>}
              {email && <a href={`mailto:${email}`} className="block text-green hover:underline">{email}</a>}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
