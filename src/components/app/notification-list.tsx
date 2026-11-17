import Link from "next/link";
import { Bell } from "lucide-react";
import { ActionButton } from "@/components/ui/action-form";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/account";

export async function NotificationList({ userId, fallbackHref, embedded }: { userId: string; fallbackHref: string; embedded?: boolean }) {
  const items = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 80 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      {embedded
        ? (unread > 0 ? <div className="mb-4 flex justify-end"><ActionButton variant="outline" size="sm" action={markNotificationsReadAction.bind(null, undefined)}>Tout marquer comme lu</ActionButton></div> : null)
        : (
      <PageHeader title="Notifications" description={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Vous êtes à jour."}
        actions={unread > 0 ? <ActionButton variant="outline" size="sm" action={markNotificationsReadAction.bind(null, undefined)}>Tout marquer comme lu</ActionButton> : undefined} />
        )}
      {items.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? fallbackHref} className="flex gap-3.5 px-4 py-4 hover:bg-paper sm:px-5">
                  <span className={`relative flex size-11 shrink-0 items-center justify-center rounded-[14px] ${n.readAt ? "bg-sand text-muted" : "bg-marigold-soft text-[#9a6400]"}`}>
                    <Bell className="size-5" />
                    {!n.readAt && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-clay ring-2 ring-surface" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.90625rem] leading-snug ${n.readAt ? "font-medium text-ink-soft" : "font-semibold text-ink"}`}>{n.title}</span>
                    <span className="mt-0.5 block whitespace-pre-line text-[0.84375rem] text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState art="box" title="Aucune notification" />}
    </>
  );
}
