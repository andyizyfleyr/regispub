"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, side }: { title: string; description?: string; children: React.ReactNode; className?: string; side?: "center" | "bottom" | "left" }) {
  const position =
    side === "left" ? "inset-y-0 left-0 h-full w-[86%] max-w-xs rounded-none"
    : side === "bottom" ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
    : "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl";
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-forest/45" />
      <D.Content className={cn("fixed z-50 flex max-h-[90dvh] flex-col overflow-hidden bg-surface shadow-pop focus:outline-none", position, className)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <D.Title className="text-base font-semibold tracking-normal [font-family:var(--font-sans)]">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-mr-1.5 -mt-1 rounded-md p-1.5 text-muted hover:bg-sand hover:text-ink" aria-label="Fermer"><X className="size-4" /></D.Close>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
