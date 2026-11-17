import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Smartphone, Users } from "lucide-react";
import { Logo } from "@/components/icons";
import { isStaff } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

const POINTS = [
  { icon: Smartphone, label: "Payez par Mobile Money", short: "Mobile Money" },
  { icon: Users, label: "Une équipe lance votre campagne", short: "Une équipe vous aide" },
  { icon: ShieldCheck, label: "Prix affichés avant de payer", short: "Prix clairs" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(isStaff(user.role) ? "/gestion" : "/app");
  return (
    <div className="grid min-h-dvh bg-forest lg:grid-cols-[1fr_minmax(0,34rem)] lg:bg-surface">
      <aside className="bg-brand relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
        <Link href="/" className="relative"><Logo light /></Link>
        <div className="relative max-w-md">
          <p className="font-display text-[2.5rem] font-semibold leading-[1.05]">La publicité en ligne, sans carte bancaire.</p>
          <ul className="mt-10 space-y-4 text-[0.9375rem] text-white/85">
            {POINTS.map((pt) => (
              <li key={pt.label} className="flex items-center gap-3.5"><span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-white/10 text-marigold ring-1 ring-inset ring-white/10"><pt.icon className="size-5" /></span>{pt.label}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">Cotonou, Bénin</p>
      </aside>
      <main className="flex min-h-dvh flex-col lg:min-h-0 lg:justify-center">
        {/* Téléphone : bandeau de marque en haut, formulaire sur une feuille blanche arrondie. */}
        <div className="bg-brand relative overflow-hidden px-5 pb-10 pt-5 text-white lg:hidden">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-mint/20 blur-2xl" />
          <Link href="/" className="relative inline-flex"><Logo light /></Link>
          <p className="relative mt-4 max-w-[15rem] font-display text-[1.25rem] font-semibold leading-[1.15]">La publicité en ligne, sans carte bancaire.</p>
          <ul className="relative mt-3 flex flex-wrap gap-1.5 text-[0.75rem] text-white/90">
            {POINTS.map((pt) => <li key={pt.short} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-inset ring-white/10"><pt.icon className="size-3.5 text-marigold" />{pt.short}</li>)}
          </ul>
        </div>
        <div className="relative -mt-6 flex flex-1 flex-col rounded-t-[24px] bg-surface px-5 pb-10 pt-6 sm:px-10 lg:mt-0 lg:flex-none lg:rounded-none lg:py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
