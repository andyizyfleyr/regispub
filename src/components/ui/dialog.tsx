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
    side === "left" ? "inset-y-0 left-0 h-full max-h-none w-[86%] max-w-xs animate-drawer rounded-none"
    : side === "center" ? "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-pop rounded-2xl"
    : "inset-x-0 bottom-0 max-h-[88dvh] animate-sheet rounded-t-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop sm:rounded-2xl";
  const sheet = side !== "left" && side !== "center";
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 animate-fade bg-forest/40 backdrop-blur-[3px]" />
      <D.Content className={cn("fixed z-50 flex max-h-[90dvh] flex-col overflow-hidden bg-surface shadow-pop focus:outline-none", position, className)}>
        {sheet && <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />}
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <D.Title className="text-base font-semibold tracking-normal [font-family:var(--font-sans)]">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[0.8125rem] text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-mr-1.5 -mt-1 rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label="Fermer"><X className="size-4" /></D.Close>
        </div>
        <div className={cn("overflow-y-auto p-5", sheet && "safe-bottom")}>{children}</div>
      </D.Content>
    </D.Portal>
  );
}
