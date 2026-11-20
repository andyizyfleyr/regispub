"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ErrorsContext } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/action";

/**
 * Formulaire d'un groupe de clés. L'envoi est fait à la main (et non par l'attribut `action`) :
 * en cas d'erreur, ce qui vient d'être collé reste dans les champs au lieu d'être effacé.
 */
export function KeysForm({ action, children }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; children: React.ReactNode }) {
  const [state, setState] = React.useState<ActionState>(null);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const ref = React.useRef<HTMLFormElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const res = await action(null, data);
      setState(res);
      if (!res?.ok) return;
      if (res.message) toast.success(res.message);
      ref.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={ref} onSubmit={submit} autoComplete="off" className="space-y-4">
      <ErrorsContext.Provider value={state?.fieldErrors ?? {}}>{children}</ErrorsContext.Provider>
      {state && !state.ok && state.error && <p role="alert" className="rounded-md border border-clay/25 bg-clay-soft px-3 py-2 text-[0.8125rem] text-clay">{state.error}</p>}
      <Button type="submit" disabled={pending} aria-busy={pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
