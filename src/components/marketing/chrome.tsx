import Link from "next/link";
import { Logo } from "@/components/icons";
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
          <Link href="/#fonctionnement" className="hover:text-ink">Fonctionnement</Link>
          <Link href="/#objectifs" className="hover:text-ink">Objectifs</Link>
          <Link href="/services" className="hover:text-ink">Services et tarifs</Link>
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
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">La publicité digitale accessible à tous les entrepreneurs d&apos;Afrique de l&apos;Ouest : création, paiement Mobile Money, gestion et suivi au même endroit.</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-3">Plateforme</p>
          <ul className="space-y-2 text-ink-soft">
            <li><Link href="/services" className="hover:text-ink">Services et tarifs</Link></li>
            <li><Link href="/app/creer" className="hover:text-ink">Créer une publicité</Link></li>
            <li><Link href="/app/expert" className="hover:text-ink">Confier à un expert</Link></li>
            <li><Link href="/conditions" className="hover:text-ink">Conditions d&apos;utilisation</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-3">Contact</p>
          <ul className="space-y-2 text-ink-soft">
            <li>Cotonou, Bénin</li>
            {supportEmail && <li><a href={`mailto:${supportEmail}`} className="hover:text-ink">{supportEmail}</a></li>}
            {supportWhatsapp && <li><a href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}`} className="hover:text-ink">WhatsApp : {supportWhatsapp}</a></li>}
            <li><Link href="/connexion" className="hover:text-ink">Espace client</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted">
          © {new Date().getFullYear()} RegisPub. Facebook et Instagram sont des marques de Meta Platforms ; TikTok est une marque de ByteDance. RegisPub est un prestataire indépendant et n&apos;est affilié à aucune de ces plateformes ni aux opérateurs de téléphonie cités.
        </p>
      </div>
    </footer>
  );
}
