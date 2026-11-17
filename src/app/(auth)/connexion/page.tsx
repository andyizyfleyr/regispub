import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { loginAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reinitialise?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-[1.375rem] font-semibold sm:text-[1.75rem]">Connexion</h1>
      {sp.reinitialise && <Notice tone="ok" className="mt-5">Mot de passe modifié.</Notice>}
      <ActionForm action={loginAction} className="mt-5 space-y-3.5 sm:mt-7 sm:space-y-4" refresh={false}>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="Adresse e-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com" /></Field>
        <Field label="Mot de passe" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton size="lg" className="w-full" pendingLabel="Connexion…">Se connecter</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/mot-de-passe-oublie" className="text-muted hover:text-ink">Mot de passe oublié ?</Link>
        <Link href={`/inscription${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-medium text-green hover:underline">Créer un compte</Link>
      </div>
    </>
  );
}
