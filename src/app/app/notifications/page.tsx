import type { Metadata } from "next";
import { NotificationList } from "@/components/app/notification-list";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  return <NotificationList userId={user.id} fallbackHref="/app" />;
}
