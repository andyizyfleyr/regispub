import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type de compte" htmlFor="accountType">
            <Select id="accountType" name="accountType" defaultValue="INDIVIDUAL"><option value="INDIVIDUAL">Particulier</option><option value="PROFESSIONAL">Professionnel</option></Select>
          </Field>
          <Field label="Code parrain" htmlFor="referral" optional><Input id="referral" name="referral" defaultValue={sp.parrain ?? ""} className="uppercase" /></Field>
        </div>
        <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4" />
          <span>J&apos;accepte les <Link href="/conditions" className="underline" target="_blank">conditions</Link>. Les résultats ne sont pas garantis.</span>
        </label>
        <SubmitButton size="lg" className="w-full" pendingLabel="Création…">Créer mon compte</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">Déjà inscrit ? <Link href="/connexion" className="font-medium text-green hover:underline">Se connecter</Link></p>
    </>
  );
}
