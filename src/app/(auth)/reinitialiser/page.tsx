import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  if (!jeton) return <Notice tone="danger" title="Lien incomplet">Ouvrez le lien reçu par e-mail ou <Link href="/mot-de-passe-oublie" className="underline">faites une nouvelle demande</Link>.</Notice>;
  return (
    <>
      <h1 className="text-[1.375rem] font-semibold sm:text-[1.75rem]">Nouveau mot de passe</h1>
      <ActionForm action={resetPasswordAction} className="mt-5 space-y-3.5 sm:mt-7 sm:space-y-4" refresh={false}>
        <input type="hidden" name="token" value={jeton} />
        <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères, une lettre et un chiffre."><Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <SubmitButton size="lg" className="w-full">Enregistrer</SubmitButton>
      </ActionForm>
    </>
  );
}
