import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { allowedStaffNav } from "@/lib/auth/staff-nav";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Gestion", template: "%s · Gestion RegisPub" }, robots: { index: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return <AppShell area="staff" user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} unread={unread} allowed={allowedStaffNav(user.role)}>{children}</AppShell>;
}
