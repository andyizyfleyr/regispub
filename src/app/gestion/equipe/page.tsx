import type { Metadata } from "next";
import { RoleSelect } from "@/components/staff/admin-panels";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader, Table } from "@/components/ui/misc";
import { assignableRoles, canManageAccount, PERMISSIONS, permissionsOf, ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { createStaffAction, setUserStatusAction } from "@/server/actions/staff-admin";

export const metadata: Metadata = { title: "Collaborateurs" };

export default async function TeamPage() {
  const actor = await requirePermission("staff.manage");
  const staff = await db.user.findMany({ where: { role: { not: "CLIENT" } }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { managedCampaigns: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } } } });
  const roles = assignableRoles(actor.role).filter((r) => r !== "CLIENT");
  return (
    <>
      <PageHeader title="Collaborateurs" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <Table head={["Collaborateur", "Rôle", "Campagnes suivies", "Dernière connexion", ""]}>
              {staff.map((u) => {
                const manageable = u.id !== actor.id && canManageAccount(actor.role, u.role);
                return (
                  <tr key={u.id}>
                    <td><span className="block font-medium text-ink">{u.name}{u.id === actor.id && <span className="ml-1.5 text-xs font-normal text-muted">(vous)</span>}</span><span className="block text-xs text-muted">{u.email}</span>{u.status === "SUSPENDED" && <Badge tone="danger">Suspendu</Badge>}</td>
                    <td>{manageable ? <RoleSelect userId={u.id} role={u.role} roles={roles.map((r) => ({ id: r, label: ROLE_LABELS[r] }))} /> : ROLE_LABELS[u.role]}</td>
                    <td className="tnum">{u._count.managedCampaigns}</td>
                    <td className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</td>
                    <td className="text-right">
                      {manageable && (u.status === "ACTIVE"
                        ? <ActionButton variant="ghost" size="sm" className="text-clay" action={setUserStatusAction.bind(null, u.id, "SUSPENDED")} confirm={`Suspendre ${u.name} ?`} successMessage="Compte suspendu.">Suspendre</ActionButton>
                        : <ActionButton variant="outline" size="sm" action={setUserStatusAction.bind(null, u.id, "ACTIVE")} successMessage="Compte réactivé.">Réactiver</ActionButton>)}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
          <Card>
            <CardHeader title="Droits par rôle" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead><tr className="border-b border-line text-muted"><th className="px-4 sm:px-5 py-2.5 font-medium">Permission</th>{STAFF_ROLES.map((r) => <th key={r} className="px-2 py-2.5 text-center font-medium">{ROLE_LABELS[r]}</th>)}</tr></thead>
                <tbody>
                  {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).map((p) => (
                    <tr key={p} className="border-b border-line last:border-0">
                      <td className="px-4 sm:px-5 py-2 text-ink-soft">{PERMISSIONS[p]}</td>
                      {STAFF_ROLES.map((r) => <td key={r} className="px-2 py-2 text-center">{permissionsOf(r).includes(p) ? <span className="text-green" aria-label="Autorisé">●</span> : <span className="text-line-strong" aria-label="Refusé">–</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title="Ajouter un collaborateur" />
          <CardBody>
            <ActionForm action={createStaffAction} resetOnSuccess className="space-y-4">
              <Field label="Nom complet" htmlFor="st-name"><Input id="st-name" name="name" required maxLength={80} /><FieldError name="name" /></Field>
              <Field label="E-mail" htmlFor="st-email"><Input id="st-email" name="email" type="email" required autoComplete="off" /><FieldError name="email" /></Field>
              <Field label="Rôle" htmlFor="st-role"><Select id="st-role" name="role" defaultValue="AD_MANAGER">{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select><FieldError name="role" /></Field>
              <Field label="Mot de passe provisoire" htmlFor="st-pw" hint="10 caractères minimum, lettres et chiffres. À transmettre par un canal sûr."><Input id="st-pw" name="password" type="text" required minLength={10} autoComplete="off" className="font-mono text-[13px]" /><FieldError name="password" /></Field>
              <SubmitButton pendingLabel="Création…">Créer le compte</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
