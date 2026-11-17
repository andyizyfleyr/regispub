import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { requestPasswordResetAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-[1.375rem] font-semibold sm:text-[1.75rem]">Mot de passe oublié</h1>
      <p className="mt-1.5 text-muted">Nous vous envoyons un lien valable une heure.</p>
      <ActionForm action={requestPasswordResetAction} className="mt-5 space-y-3.5 sm:mt-7 sm:space-y-4" refresh={false} resetOnSuccess>
        <Field label="Adresse e-mail" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
        <SubmitButton size="lg" className="w-full">Recevoir le lien</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm"><Link href="/connexion" className="text-muted hover:text-ink">← Connexion</Link></p>
    </>
  );
}
