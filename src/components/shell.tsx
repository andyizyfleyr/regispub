"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import {
  Bell, ChartColumn, ChevronsUpDown, CreditCard, Ellipsis, FolderKanban, Headset, House, LifeBuoy, LogOut, Megaphone, Menu, PlugZap, Plus,
  ReceiptText, ScrollText, Send, Settings, ShieldCheck, Sparkles, Tags, TicketPercent, UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/icons";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, initials } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

type NavItem = { id: string; href: string; label: string; short?: string; icon: LucideIcon; exact?: boolean; group?: string };

const CLIENT_NAV: NavItem[] = [
  { id: "home", href: "/app", label: "Accueil", icon: House, exact: true },
  { id: "campaigns", href: "/app/campagnes", label: "Mes campagnes", short: "Campagnes", icon: Megaphone },
  { id: "payments", href: "/app/paiements", label: "Paiements", icon: Wallet },
  { id: "assistant", href: "/app/assistant", label: "Assistant marketing", short: "Assistant", icon: Sparkles },
  { id: "account", href: "/app/compte", label: "Mon compte", short: "Compte", icon: UserRound },
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
  { id: "notifications", href: "/gestion/notifications", label: "Notifications", icon: Send, group: "Plateforme" },
  { id: "integrations", href: "/gestion/integrations", label: "Intégrations", icon: PlugZap, group: "Plateforme" },
  { id: "settings", href: "/gestion/parametres", label: "Paramètres", icon: Settings, group: "Plateforme" },
  { id: "audit", href: "/gestion/journal", label: "Journal d'audit", icon: ScrollText, group: "Plateforme" },
];

const EXTRA_TITLES: [RegExp, string][] = [
  [/^\/app\/creer/, "Créer une publicité"],
  [/^\/app\/expert/, "Confier à un expert"],
  [/^\/app\/notifications/, "Notifications"],
];

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
            {heading && <p className="eyebrow mb-1.5 mt-5 px-3 first:mt-0">{heading}</p>}
            <Link
              href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors",
                active ? "bg-green-soft font-semibold text-forest" : "text-ink-soft hover:bg-paper hover:text-ink",
              )}
            >
              {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-green" />}
              <item.icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-green" : "text-muted group-hover:text-ink-soft")} />
              {item.label}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-[12.5px] font-semibold text-white", className)}>{initials(name)}</span>;
}

const menuItem = "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[14px] text-ink-soft outline-none data-[highlighted]:bg-paper data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-muted";

function UserMenu({ user, area, compact }: { user: { name: string; roleLabel: string }; area: "client" | "staff"; compact?: boolean }) {
  const [pending, start] = React.useTransition();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Menu du compte"
        className={cn("flex items-center gap-3 rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-green", compact ? "rounded-full" : "w-full border border-line p-2 hover:border-line-strong hover:bg-paper")}
      >
        <Avatar name={user.name} className={compact ? "size-8 text-[11.5px]" : undefined} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.roleLabel}</span>
            </span>
            <ChevronsUpDown className="mr-1 size-4 shrink-0 text-muted" />
          </>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} sideOffset={8} className="z-50 w-60 animate-pop rounded-md border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.roleLabel}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {area === "client" && <DropdownMenu.Item asChild><Link href="/app/compte" className={menuItem}><UserRound />Mon compte</Link></DropdownMenu.Item>}
          {area === "client" && <DropdownMenu.Item asChild><Link href="/app/compte?onglet=aide" className={menuItem}><LifeBuoy />Aide et réclamations</Link></DropdownMenu.Item>}
          <DropdownMenu.Item asChild><Link href={area === "client" ? "/app/notifications" : "/gestion/notifications?vue=miennes"} className={menuItem}><Bell />Notifications</Link></DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item disabled={pending} onSelect={(e) => { e.preventDefault(); start(async () => { await logoutAction(); }); }} className={cn(menuItem, "data-[highlighted]:bg-clay-soft data-[highlighted]:text-clay")}>
            <LogOut />{pending ? "Déconnexion…" : "Se déconnecter"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({ area, user, unread, allowed, children }: {
  area: "client" | "staff"; user: { name: string; roleLabel: string }; unread: number; allowed?: string[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const client = area === "client";
  const all = client ? CLIENT_NAV : STAFF_NAV.filter((i) => !allowed || allowed.includes(i.id));
  const home = client ? "/app" : "/gestion";
  const notifHref = client ? "/app/notifications" : "/gestion/notifications?vue=miennes";
  // L'assistant de création occupe tout l'écran sur mobile : la barre du bas y est masquée.
  const immersive = /^\/app\/(creer|expert)\/.+/.test(pathname);
  const creating = /^\/app\/(creer|expert)/.test(pathname);
  const title = EXTRA_TITLES.find(([re]) => re.test(pathname))?.[1] ?? all.find((i) => isActive(pathname, i))?.label ?? (client ? "Accueil" : "Gestion");

  const bell = (
    <Link href={notifHref} className="relative flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex">
          <span aria-hidden className="absolute inset-0 animate-ping-soft rounded-full bg-clay" />
          <span className="tnum relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white ring-2 ring-surface">{unread > 9 ? "9+" : unread}</span>
        </span>
      )}
    </Link>
  );

  const createButton = (onNavigate?: () => void) => (
    <Link href="/app/creer" onClick={onNavigate} aria-current={creating ? "page" : undefined}
      className="flex h-11 items-center justify-center gap-2 rounded-md bg-marigold text-sm font-semibold text-forest shadow-glow transition-[background-color,transform] hover:bg-marigold-600 active:scale-[0.98]">
      <Plus className="size-[18px]" strokeWidth={2.4} />Créer une publicité
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-5 flex h-10 items-center justify-between px-2">
          <Link href={home}><Logo /></Link>
          {!client && <span className="rounded-full bg-forest px-2.5 py-1 text-[11px] font-semibold text-white">Gestion</span>}
        </div>
        {client && <div className="mb-5">{createButton()}</div>}
        <div className="scrollbar-none -mx-1 flex-1 overflow-y-auto px-1"><NavLinks items={all} pathname={pathname} /></div>
        {client && (
          <Link href="/app/expert" className="bg-brand group relative mb-4 mt-4 overflow-hidden rounded-lg p-4 text-white">
            <span aria-hidden className="bg-grid absolute inset-0 opacity-60" />
            <span className="relative flex size-9 items-center justify-center rounded-md bg-white/10 text-marigold"><Headset className="size-[18px]" /></span>
            <span className="relative mt-3 block text-[14px] font-semibold leading-snug">Pas le temps ?</span>
            <span className="relative mt-0.5 block text-[13px] leading-snug text-white/70">Un expert prépare et lance votre publicité.</span>
            <span className="relative mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-marigold">Confier ma publicité<span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span></span>
          </Link>
        )}
        <UserMenu user={user} area={area} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-4 lg:h-16 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {!client && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger className="flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sand lg:hidden" aria-label="Ouvrir le menu"><Menu className="size-5" /></DialogTrigger>
                <DialogContent title="Menu" side="left"><NavLinks items={all} pathname={pathname} onNavigate={() => setOpen(false)} /></DialogContent>
              </Dialog>
            )}
            <Link href={home} className="lg:hidden"><Logo /></Link>
            <p className="hidden min-w-0 items-center gap-2 text-[13.5px] text-muted lg:flex">
              <span>{client ? "Espace annonceur" : "Espace de gestion"}</span>
              <span aria-hidden className="text-line-strong">/</span>
              <span className="truncate font-medium text-ink">{title}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {client && (
              <Link href="/app/expert" className="mr-1 hidden h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink md:flex">
                <Headset className="size-4 text-green" />Parler à un expert
              </Link>
            )}
            {bell}
            <span className="lg:hidden"><UserMenu user={user} area={area} compact /></span>
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9", client && !immersive && "pb-28 lg:pb-9")}>{children}</main>

        {client && !immersive && (
          <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-surface/90 px-1 pt-1.5 backdrop-blur-md lg:hidden" aria-label="Navigation principale">
            {[CLIENT_NAV[0]!, CLIENT_NAV[1]!].map((item) => <BottomLink key={item.id} item={item} active={isActive(pathname, item)} />)}
            <Link href="/app/creer" aria-current={creating ? "page" : undefined} className="-mt-6 flex flex-col items-center gap-0.5 pb-1 text-[10.5px] font-semibold text-forest">
              <span className="flex size-[3.25rem] items-center justify-center rounded-full bg-marigold shadow-glow ring-4 ring-surface transition-transform active:scale-95"><Plus className="size-6" strokeWidth={2.4} /></span>
              Créer
            </Link>
            <BottomLink item={CLIENT_NAV[2]!} active={isActive(pathname, CLIENT_NAV[2]!)} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="flex flex-col items-center gap-0.5 py-1 text-[10.5px] text-muted">
                <span className="flex h-7 w-12 items-center justify-center rounded-full"><Ellipsis className="size-5" /></span>Plus
              </DialogTrigger>
              <DialogContent title="Menu" side="bottom">
                <div className="mb-3">{createButton(() => setOpen(false))}</div>
                <NavLinks items={all} pathname={pathname} onNavigate={() => setOpen(false)} />
                <Link href="/app/expert" onClick={() => setOpen(false)} className="mt-3 flex items-center gap-3 rounded-md bg-paper px-3 py-3 text-[14px] font-medium text-ink">
                  <Headset className="size-[18px] text-green" />Confier ma publicité à un expert
                </Link>
              </DialogContent>
            </Dialog>
          </nav>
        )}
      </div>
    </div>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-1 text-[10.5px]", active ? "font-semibold text-forest" : "text-muted")}>
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-green-soft text-green")}><item.icon className="size-5" /></span>
      {item.short ?? item.label}
    </Link>
  );
}
