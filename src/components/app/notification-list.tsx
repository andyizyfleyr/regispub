import { NotificationRows } from "@/components/app/notification-rows";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export async function NotificationList({ userId, fallbackHref, embedded }: { userId: string; fallbackHref: string; embedded?: boolean }) {
  const items = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 80 });
  return (
    <>
      {!embedded && <PageHeader title="Notifications" />}
      {items.length ? (
        <Card>
          <NotificationRows items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.link ?? fallbackHref, date: formatDateTime(n.createdAt), unread: !n.readAt }))} />
        </Card>
      ) : <EmptyState art="box" title="Aucune notification" />}
    </>
  );
}
