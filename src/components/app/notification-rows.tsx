"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions/account";

export type NotificationRow = { id: string; title: string; body: string; href: string; date: string; unread: boolean };

/**
 * Liste des notifications. Les ouvrir suffit à les marquer comme lues : la pastille de la cloche s'efface sans autre geste.
 * Celles qui étaient nouvelles à l'arrivée restent mises en avant le temps de la visite.
 */
export function NotificationRows({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [fresh] = React.useState(() => new Set(items.filter((n) => n.unread).map((n) => n.id)));
  const busy = React.useRef(false);
  React.useEffect(() => {
    if (busy.current || !items.some((n) => n.unread)) return;
    busy.current = true;
    void markNotificationsReadAction().then(() => router.refresh()).catch(() => undefined).finally(() => { busy.current = false; });
  }, [items, router]);

  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const isNew = n.unread || fresh.has(n.id);
        return (
          <li key={n.id}>
            <Link href={n.href} className="flex gap-3.5 px-4 py-4 hover:bg-paper sm:px-5">
              <span className={`relative flex size-11 shrink-0 items-center justify-center rounded-[14px] ${isNew ? "bg-marigold-soft text-[#9a6400]" : "bg-sand text-muted"}`}>
                <Bell className="size-5" />
                {isNew && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-clay ring-2 ring-surface" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.90625rem] leading-snug ${isNew ? "font-semibold text-ink" : "font-medium text-ink-soft"}`}>{n.title}{isNew && <span className="sr-only"> (nouvelle)</span>}</span>
                <span className="mt-0.5 block whitespace-pre-line text-[0.84375rem] text-muted">{n.body}</span>
                <span className="mt-1 block text-xs text-muted">{n.date}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
