"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { ActionState } from "@/server/action";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

type FormActionFn = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const ErrorsContext = React.createContext<Partial<Record<string, string>>>({});
export const useFieldErrors = () => React.useContext(ErrorsContext);

/** Formulaire relié à une Server Action : états de chargement, erreurs par champ et message de confirmation. */
export function ActionForm({ action, children, className, successMessage, resetOnSuccess, onSuccess, refresh = true, inlineError = true }: {
  action: FormActionFn; children: React.ReactNode; className?: string; successMessage?: string; resetOnSuccess?: boolean;
  onSuccess?: (state: NonNullable<ActionState>) => void; refresh?: boolean; inlineError?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      const msg = state.message ?? successMessage;
      if (msg) toast.success(msg);
      if (resetOnSuccess) ref.current?.reset();
      onSuccessRef.current?.(state);
      if (refresh) router.refresh();
    } else if (state.error && !inlineError) toast.error(state.error);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={ref} action={formAction} className={className} noValidate={false}>
      <ErrorsContext.Provider value={state?.fieldErrors ?? {}}>{children}</ErrorsContext.Provider>
      {inlineError && state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-md border border-clay/25 bg-clay-soft px-3 py-2 text-[0.8125rem] text-clay">{state.error}</p>
      )}
    </form>
  );
}

export function SubmitButton({ children, className, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={className} {...props}>
      {pending && <LoaderCircle className="animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Bouton déclenchant une action serveur sans formulaire (avec confirmation facultative). */
export function ActionButton({ action, confirm, successMessage, children, onDone, ...props }: ButtonProps & {
  action: () => Promise<ActionState | { ok: boolean; error?: string; message?: string } | void>; confirm?: string; successMessage?: string; onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button" disabled={pending || props.disabled} aria-busy={pending} {...props}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res && !res.ok) { toast.error(res.error ?? "Action impossible."); return; }
          const msg = (res && res.message) || successMessage;
          if (msg) toast.success(msg);
          onDone?.();
          router.refresh();
        });
      }}
    >
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}

export function FieldError({ name, className }: { name: string; className?: string }) {
  const errors = useFieldErrors();
  return errors[name] ? <p className={cn("text-[0.8125rem] text-clay", className)}>{errors[name]}</p> : null;
}
