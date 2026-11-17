"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, BookOpen, ChartColumn, CirclePlus, CreditCard, Ellipsis, FolderKanban, House, LayoutTemplate, LifeBuoy, LogOut, Megaphone, Menu, Palette, PlugZap,
  ReceiptText, ScrollText, Send, Settings, ShieldCheck, Sparkles, Tags, TicketPercent, UserRound, Users, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/icons";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, initials } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

type NavItem = { id: string; href: string; label: string; icon: LucideIcon; exact?: boolean; group?: string };

const CLIENT_NAV: NavItem[] = [
  { id: "home", href: "/app", label: "Accueil", icon: House, exact: true },
  { id: "create", href: "/app/creer", label: "Créer une publicité", icon: CirclePlus },
  { id: "campaigns", href: "/app/campagnes", label: "Mes campagnes", icon: Megaphone },
  { id: "studio", href: "/app/studio", label: "Studio créatif", icon: Palette },
  { id: "assistant", href: "/app/assistant", label: "Assistant IA", icon: Sparkles },
  { id: "payments", href: "/app/paiements", label: "Paiements", icon: CreditCard },
  { id: "account", href: "/app/compte", label: "Mon compte", icon: UserRound },
];

const STAFF_NAV: NavItem[] = [
  { id: "home", href: "/gestion", label: "Tableau de bord", icon: House, exact: true, group: "Activité" },
  { id: "campaigns", href: "/gestion/campagnes", label: "Campagnes", icon: FolderKanban, group: "Activité" },
  { id: "orders", href: "/gestion/commandes", label: "Commandes", icon: ReceiptText, group: "Activité" },
  { id: "payments", href: "/gestion/paiements", label: "Paiements", icon: CreditCard, group: "Activité" },
  { id: "tickets", href: "/gestion/reclamations", label: "Réclamations", icon: LifeBuoy, group: "Activité" },
  { id: "reports", href: "/gestion/rapports", label: "Rapports", icon: ChartColumn, group: "Activité" },
  { id: "users", href: "/gestion/utilisateurs", label: "Clients et entreprises", icon: Users, group: "Comptes" },
  { id: "staff", href: "/gestion/equipe", label: "Collaborateurs", icon: ShieldCheck, group: "Comptes" },
  { id: "services", href: "/gestion/services", label: "Prestations et tarifs", icon: Tags, group: "Catalogue" },
  { id: "promos", href: "/gestion/promos", label: "Codes promotionnels", icon: TicketPercent, group: "Catalogue" },
  { id: "templates", href: "/gestion/modeles", label: "Modèles de création", icon: LayoutTemplate, group: "Catalogue" },
  { id: "notifications", href: "/gestion/notifications", label: "Notifications", icon: Send, group: "Plateforme" },
  { id: "integrations", href: "/gestion/integrations", label: "Intégrations", icon: PlugZap, group: "Plateforme" },
  { id: "settings", href: "/gestion/parametres", label: "Paramètres", icon: Settings, group: "Plateforme" },
  { id: "audit", href: "/gestion/journal", label: "Journal d'audit", icon: ScrollText, group: "Plateforme" },
];

const MOBILE_CLIENT = ["home", "campaigns", "create", "studio"];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  let lastGroup: string | undefined;
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const heading = item.group && item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        return (
          <React.Fragment key={item.id}>
            {heading && <p className="eyebrow mb-1 mt-5 px-3 first:mt-0">{heading}</p>}
            <Link
              href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors", active ? "bg-forest font-medium text-white" : "text-ink-soft hover:bg-sand hover:text-ink")}
            >
              <item.icon className={cn("size-[18px] shrink-0", active ? "text-marigold" : "text-muted")} />
              {item.label}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function UserBlock({ user }: { user: { name: string; roleLabel: string } }) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 pt-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand text-[13px] font-semibold text-ink-soft">{initials(user.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.roleLabel}</p>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="rounded-md p-2 text-muted hover:bg-sand hover:text-ink" aria-label="Se déconnecter" title="Se déconnecter"><LogOut className="size-4" /></button>
      </form>
    </div>
  );
}

export function AppShell({ area, user, unread, allowed, children }: {
  area: "client" | "staff"; user: { name: string; roleLabel: string }; unread: number; allowed?: string[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const all = area === "client" ? CLIENT_NAV : STAFF_NAV.filter((i) => !allowed || allowed.includes(i.id));
  const home = area === "client" ? "/app" : "/gestion";
  const notifHref = area === "client" ? "/app/notifications" : "/gestion/notifications?vue=miennes";
  // L'assistant de création occupe tout l'écran sur mobile : la barre du bas y est masquée.
  const immersive = /^\/app\/(creer|expert)\/.+/.test(pathname) || /^\/app\/studio\/editeur/.test(pathname);

  const bell = (
    <Link href={notifHref} className="relative rounded-md p-2 text-ink-soft hover:bg-sand" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
      <Bell className="size-5" />
      {unread > 0 && <span className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center justify-between px-3">
          <Link href={home}><Logo /></Link>
          {bell}
        </div>
        {area === "staff" && <p className="mx-3 mb-4 rounded-md bg-sand px-2.5 py-1.5 text-xs font-medium text-ink-soft">Espace de gestion</p>}
        <div className="scrollbar-none -mx-1 flex-1 overflow-y-auto px-1"><NavLinks items={all} pathname={pathname} /></div>
        {area === "client" && (
          <Link href="/app/expert" className="mx-1 mb-4 mt-4 rounded-lg border border-line bg-paper p-3.5 text-[13px] hover:border-line-strong">
            <span className="flex items-center gap-2 font-medium text-ink"><BookOpen className="size-4 text-green" />Besoin d&apos;aide ?</span>
            <span className="mt-1 block text-muted">Confiez votre publicité à un expert.</span>
          </Link>
        )}
        <UserBlock user={user} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-3 backdrop-blur lg:hidden">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="rounded-md p-2 text-ink-soft hover:bg-sand" aria-label="Ouvrir le menu"><Menu className="size-5" /></DialogTrigger>
            <DialogContent title="Menu" side="left">
              <NavLinks items={all} pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-6"><UserBlock user={user} /></div>
            </DialogContent>
          </Dialog>
          <Link href={home}><Logo /></Link>
          {bell}
        </header>

        <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9", area === "client" && !immersive && "pb-24 lg:pb-9")}>{children}</main>

        {area === "client" && !immersive && (
          <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pt-1.5 backdrop-blur lg:hidden" aria-label="Navigation principale">
            {MOBILE_CLIENT.map((id) => CLIENT_NAV.find((i) => i.id === id)!).map((item) => {
              const active = isActive(pathname, item);
              const primary = item.id === "create";
              return (
                <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-1 text-[10.5px]", active ? "font-semibold text-forest" : "text-muted")}>
                  <span className={cn("flex size-8 items-center justify-center rounded-full", primary && "bg-marigold text-forest")}><item.icon className="size-5" /></span>
                  {item.id === "home" ? "Accueil" : item.id === "create" ? "Créer" : item.id === "campaigns" ? "Campagnes" : "Studio"}
                </Link>
              );
            })}
            <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-1 text-[10.5px] text-muted">
              <span className="flex size-8 items-center justify-center"><Ellipsis className="size-5" /></span>Plus
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
