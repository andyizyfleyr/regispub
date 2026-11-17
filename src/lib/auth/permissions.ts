// Matrice des permissions. Aucune dépendance serveur : utilisable aussi pour masquer des éléments d'interface
// (le contrôle effectif est toujours refait côté serveur).
export type RoleName = "SUPER_ADMIN" | "ADMIN" | "AD_MANAGER" | "DESIGNER" | "SUPPORT" | "CLIENT";

export const PERMISSIONS = {
  "backoffice.access": "Accéder à l'espace de gestion",
  "campaign.view_all": "Voir toutes les campagnes",
  "campaign.view_assigned": "Voir les campagnes attribuées",
  "campaign.assign": "Attribuer les campagnes",
  "campaign.update_status": "Mettre à jour les statuts",
  "campaign.manage_creatives": "Préparer et soumettre les créations",
  "campaign.message": "Échanger avec les clients",
  "access.reveal": "Voir les identifiants confiés par les clients",
  "revision.manage": "Traiter les demandes de modification",
  "metrics.import": "Saisir ou importer des statistiques",
  "metrics.validate": "Valider les statistiques publiées",
  "order.view": "Voir les commandes",
  "payment.view": "Voir les paiements",
  "payment.verify": "Relancer la vérification d'un paiement",
  "payment.refund": "Gérer les remboursements",
  "pricing.manage": "Gérer les prestations et tarifs",
  "promo.manage": "Gérer les codes promotionnels",
  "user.view": "Voir les utilisateurs et entreprises",
  "user.manage": "Suspendre ou réactiver des comptes",
  "staff.manage": "Gérer les collaborateurs et leurs rôles",
  "staff.manage_admins": "Nommer des administrateurs",
  "ticket.manage": "Traiter les réclamations",
  "notification.send": "Envoyer des notifications",
  "report.view": "Consulter les rapports d'activité",
  "settings.manage": "Modifier les paramètres de la plateforme",
  "integration.view": "Voir l'état des intégrations",
  "audit.view": "Consulter le journal d'audit",
} as const;

export type Permission = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as Permission[];

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL.filter((p) => p !== "staff.manage_admins"),
  AD_MANAGER: [
    "backoffice.access", "campaign.view_all", "campaign.assign", "campaign.update_status", "campaign.manage_creatives",
    "campaign.message", "revision.manage", "metrics.import", "metrics.validate", "order.view", "payment.view", "report.view", "access.reveal",
  ],
  DESIGNER: ["backoffice.access", "campaign.view_assigned", "campaign.manage_creatives", "campaign.message", "revision.manage"],
  SUPPORT: [
    "backoffice.access", "campaign.view_all", "campaign.message", "order.view", "payment.view", "payment.verify",
    "user.view", "ticket.manage", "notification.send",
  ],
  CLIENT: [],
};

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  AD_MANAGER: "Gestionnaire publicitaire",
  DESIGNER: "Designer",
  SUPPORT: "Support client",
  CLIENT: "Client",
};

export const STAFF_ROLES: RoleName[] = ["SUPER_ADMIN", "ADMIN", "AD_MANAGER", "DESIGNER", "SUPPORT"];

export function can(role: RoleName, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: RoleName): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function isStaff(role: RoleName) {
  return role !== "CLIENT";
}

/** Rôles qu'un acteur a le droit d'attribuer à un autre compte. */
export function assignableRoles(actor: RoleName): RoleName[] {
  if (!can(actor, "staff.manage")) return [];
  const base: RoleName[] = ["AD_MANAGER", "DESIGNER", "SUPPORT", "CLIENT"];
  return can(actor, "staff.manage_admins") ? ["SUPER_ADMIN", "ADMIN", ...base] : base;
}

/** Un acteur ne peut modifier que des comptes de rang inférieur ou égal à ce qu'il peut attribuer. */
export function canManageAccount(actor: RoleName, target: RoleName) {
  return assignableRoles(actor).includes(target);
}

type CampaignAccess = { userId: string; managerId: string | null; designerId: string | null };

export function canViewCampaign(user: { id: string; role: RoleName }, c: CampaignAccess) {
  if (user.role === "CLIENT") return c.userId === user.id;
  if (can(user.role, "campaign.view_all")) return true;
  if (can(user.role, "campaign.view_assigned")) return c.managerId === user.id || c.designerId === user.id;
  return false;
}
