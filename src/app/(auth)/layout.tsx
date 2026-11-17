import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Smartphone, Users } from "lucide-react";
import { Logo } from "@/components/icons";
import { isStaff } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(isStaff(user.role) ? "/gestion" : "/app");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <aside className="relative hidden flex-col justify-between bg-forest p-12 text-white lg:flex">
        <Link href="/"><Logo light /></Link>
        <div className="max-w-md">
          <p className="font-display text-[34px] font-semibold leading-[1.1]">La publicité en ligne, sans carte bancaire.</p>
          <ul className="mt-10 space-y-5 text-[15px] text-white/80">
            <li className="flex gap-3"><Smartphone className="mt-0.5 size-5 shrink-0 text-marigold" />Payez par Mobile Money</li>
            <li className="flex gap-3"><Users className="mt-0.5 size-5 shrink-0 text-marigold" />Une équipe lance votre campagne</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-marigold" />Prix affichés avant de payer</li>
          </ul>
        </div>
        <p className="text-sm text-white/50">Cotonou, Bénin</p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="lg:hidden"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
