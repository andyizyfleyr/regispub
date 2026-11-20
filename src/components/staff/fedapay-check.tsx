"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, LoaderCircle, PlugZap, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckLine } from "@/server/actions/keys";

const ICONS = {
  ok: <CircleCheck aria-hidden className="mt-px size-4 shrink-0 text-green" />,
  warn: <TriangleAlert aria-hidden className="mt-px size-4 shrink-0 text-marigold-600" />,
  danger: <CircleAlert aria-hidden className="mt-px size-4 shrink-0 text-clay" />,
};

/** Essai des clés FedaPay enregistrées. Le résultat reste affiché : il se lit ligne par ligne. */
export function FedapayCheck({ action }: { action: () => Promise<{ ok: true; data: { lines: CheckLine[] } } | { ok: false; error: string }> }) {
  const [pending, start] = React.useTransition();
  const [lines, setLines] = React.useState<CheckLine[] | null>(null);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-[0.8125rem] text-ink-soft">Vérifiez que FedaPay accepte les clés enregistrées. Aucun paiement n&apos;est créé.</p>
        <Button type="button" variant="outline" size="sm" disabled={pending} aria-busy={pending}
          onClick={() => start(async () => { const res = await action(); setLines(res.ok ? res.data.lines : [{ tone: "danger", text: res.error }]); })}>
          {pending ? <LoaderCircle className="animate-spin" /> : <PlugZap />}Tester FedaPay
        </Button>
      </div>
      {lines && (
        <ul role="status" className="mt-3 space-y-2 rounded-md bg-sand px-3 py-3 text-[0.8125rem] text-ink">
          {lines.map((l) => <li key={l.text} className="flex items-start gap-2">{ICONS[l.tone]}<span className="min-w-0 break-words">{l.text}</span></li>)}
        </ul>
      )}
    </div>
  );
}
