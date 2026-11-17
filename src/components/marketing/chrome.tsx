import Link from "next/link";
import { Logo, WhatsappIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { isStaff } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

export async function MarketingHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" aria-label="RegisPub — accueil"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
          <Link href="/#fonctionnement" className="hover:text-ink">Étapes</Link>
          <Link href="/#objectifs" className="hover:text-ink">Objectifs</Link>
          <Link href="/services" className="hover:text-ink">Tarifs</Link>
          <Link href="/#questions" className="hover:text-ink">Questions</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm"><Link href={isStaff(user.role) ? "/gestion" : "/app"}>Mon espace</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/connexion">Connexion</Link></Button>
              <Button asChild size="sm"><Link href="/inscription">Créer ma publicité</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ supportWhatsapp, supportEmail }: { supportWhatsapp?: string; supportEmail?: string }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Logo />
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <li><Link href="/services" className="hover:text-ink">Tarifs</Link></li>
          <li><Link href="/conditions" className="hover:text-ink">Conditions</Link></li>
          <li><Link href="/connexion" className="hover:text-ink">Espace client</Link></li>
          {supportWhatsapp && <li><a href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-ink"><WhatsappIcon className="size-4" />{supportWhatsapp}</a></li>}
          {supportEmail && <li><a href={`mailto:${supportEmail}`} className="hover:text-ink">{supportEmail}</a></li>}
        </ul>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted">
          © {new Date().getFullYear()} RegisPub · Prestataire indépendant, non affilié à Meta, TikTok ni aux opérateurs cités.
        </p>
      </div>
    </footer>
  );
}
