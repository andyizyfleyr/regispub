import type { Metadata } from "next";
import { NotificationList } from "@/components/app/notification-list";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { StateBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch, ToggleRow } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Notice, PageHeader, Table, TabsNav } from "@/components/ui/misc";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notificationChannelsStatus } from "@/lib/notifications/service";
import { formatDateTime } from "@/lib/utils";
import { sendNotificationAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Notifications" };

export default async function StaffNotifications({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireStaff();
  const { vue } = await searchParams;
  const canSend = can(user.role, "notification.send");
  const view = vue === "envoi" && canSend ? "envoi" : vue === "journal" && canSend ? "journal" : "miennes";
  const base = "/gestion/notifications";
  const channels = notificationChannelsStatus();
  return (
    <>
      <PageHeader title="Notifications" />
      <TabsNav current={view} tabs={[{ id: "miennes", label: "Mes notifications", href: `${base}?vue=miennes` }, ...(canSend ? [{ id: "envoi", label: "Envoyer aux clients", href: `${base}?vue=envoi` }, { id: "journal", label: "Journal des envois", href: `${base}?vue=journal` }] : [])]} />

      {view === "miennes" && <NotificationList userId={user.id} fallbackHref="/gestion" embedded />}

      {view === "envoi" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader title="Nouvelle notification" />
            <CardBody>
              <ActionForm action={sendNotificationAction} resetOnSuccess className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Destinataires" htmlFor="nt-aud"><Select id="nt-aud" name="audience" defaultValue="one"><option value="one">Un client (par e-mail)</option><option value="active">Clients ayant payé depuis 90 jours</option><option value="all">Tous les clients actifs</option></Select></Field>
                  <Field label="E-mail du client" htmlFor="nt-email" hint="Requis pour un envoi individuel." optional><Input id="nt-email" name="email" type="email" autoComplete="off" /><FieldError name="email" /></Field>
                </div>
                <Field label="Titre" htmlFor="nt-title"><Input id="nt-title" name="title" required minLength={4} maxLength={90} /><FieldError name="title" /></Field>
                <Field label="Message" htmlFor="nt-body"><Textarea id="nt-body" name="body" rows={4} required minLength={10} maxLength={600} /><FieldError name="body" /></Field>
                <Field label="Lien dans l'espace client" htmlFor="nt-link" optional hint="Exemple : /app/creer"><Input id="nt-link" name="link" maxLength={200} placeholder="/app/…" /><FieldError name="link" /></Field>
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-[13px] font-medium text-ink-soft">Canaux supplémentaires</legend>
                  <ToggleRow label="E-mail" hint={!channels.email ? "Non configuré" : undefined} htmlFor="n-mail"><Switch id="n-mail" name="viaEmail" disabled={!channels.email} /></ToggleRow>
                  <ToggleRow label="WhatsApp" hint={!channels.whatsapp ? "Non configuré" : undefined} htmlFor="n-wa"><Switch id="n-wa" name="viaWhatsapp" disabled={!channels.whatsapp} /></ToggleRow>
                </fieldset>
                <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Notice tone="info" title="Bon usage" className="self-start">Les envois groupés sont limités à 2 000 destinataires et à 10 envois par heure. Les clients ayant désactivé un canal dans leur compte ne le reçoivent pas. Chaque envoi est tracé dans le journal d&apos;audit.</Notice>
        </div>
      )}

      {view === "journal" && <Deliveries />}
    </>
  );
}

async function Deliveries() {
  const rows = await db.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { notification: { select: { title: true } } } });
  return (
    <Card>
      {rows.length ? (
        <Table head={["Date", "Canal", "Destinataire", "Notification", "Résultat"]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap text-muted">{formatDateTime(d.createdAt)}</td>
              <td>{d.channel === "EMAIL" ? "E-mail" : "WhatsApp"}</td>
              <td className="text-[13px]">{d.recipient.replace(/(?<=.{3}).(?=[^@]*.{2}(@|$))/g, "•")}</td>
              <td className="max-w-64 truncate">{d.notification?.title ?? "—"}</td>
              <td><StateBadge kind="delivery" value={d.status} />{d.detail && <span className="mt-0.5 block max-w-64 truncate text-xs text-muted" title={d.detail}>{d.detail}</span>}</td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState title="Aucun envoi externe" />}
    </Card>
  );
}
