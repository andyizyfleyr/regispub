import Link from "next/link";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="tnum mt-10 font-display text-7xl font-semibold text-line-strong">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-muted">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Button asChild className="mt-7"><Link href="/">Retour à l&apos;accueil</Link></Button>
    </div>
  );
}
