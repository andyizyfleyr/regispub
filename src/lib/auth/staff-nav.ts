import { can, type Permission, type RoleName } from "./permissions";

/** Permission requise pour chaque entrée du menu de gestion (plusieurs = l'une suffit). */
const NAV_PERMISSIONS: Record<string, Permission[]> = {
  home: ["backoffice.access"],
  campaigns: ["campaign.view_all", "campaign.view_assigned"],
  orders: ["order.view"],
  payments: ["payment.view"],
  tickets: ["ticket.manage"],
  reports: ["report.view"],
  users: ["user.view"],
  staff: ["staff.manage"],
  services: ["pricing.manage"],
  promos: ["promo.manage"],
  templates: ["template.manage"],
  notifications: ["backoffice.access"],
  integrations: ["integration.view"],
  settings: ["settings.manage"],
  audit: ["audit.view"],
};

export function allowedStaffNav(role: RoleName): string[] {
  return Object.entries(NAV_PERMISSIONS).filter(([, perms]) => perms.some((p) => can(role, p))).map(([id]) => id);
}

/** Filtre Prisma limitant les campagnes visibles : un designer ne voit que celles qui lui sont attribuées. */
export function campaignScope(user: { id: string; role: RoleName }) {
  if (can(user.role, "campaign.view_all")) return {};
  if (can(user.role, "campaign.view_assigned")) return { OR: [{ managerId: user.id }, { designerId: user.id }] };
  return { id: "__aucune__" };
}
