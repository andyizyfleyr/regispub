import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "CLIENT") redirect("/gestion");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return <AppShell area="client" user={{ name: user.name, roleLabel: user.accountType === "PROFESSIONAL" ? "Compte professionnel" : "Compte particulier" }} unread={unread}>{children}</AppShell>;
}
