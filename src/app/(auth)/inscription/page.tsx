import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/form";
import { registerAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; parrain?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-[28px] font-semibold">Créer un compte</h1>
      <p className="mt-1.5 text-muted">Gratuit. Vous payez à la commande.</p>
      <ActionForm action={registerAction} className="mt-7 space-y-4" refresh={false}>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="Nom complet" htmlFor="name"><Input id="name" name="name" autoComplete="name" required placeholder="Afi Dossou" /></Field>
        <Field label="Adresse e-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com" /></Field>
        <Field label="Téléphone (WhatsApp)" htmlFor="phone" ><Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="01 97 00 00 00" /></Field>
        <Field label="Mot de passe" htmlFor="password" hint="8 caractères, une lettre et un chiffre."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
        {sp.parrain && <input type="hidden" name="referral" value={sp.parrain} />}
        <label className="flex items-start gap-3 text-[13px] text-ink-soft">
          <Checkbox name="terms" required aria-label="Accepter les conditions" />
          <span className="pt-0.5">J&apos;accepte les <Link href="/conditions" className="underline" target="_blank">conditions</Link>. Les résultats ne sont pas garantis.</span>
        </label>
        <SubmitButton size="lg" className="w-full" pendingLabel="Création…">Créer mon compte</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">Déjà inscrit ? <Link href="/connexion" className="font-medium text-green hover:underline">Se connecter</Link></p>
    </>
  );
}
