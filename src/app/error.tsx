"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-muted">Nous n&apos;avons pas pu afficher cette page. Réessayez ; si le problème persiste, contactez le support{error.digest ? ` en indiquant le code ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>Réessayer</Button>
    </div>
  );
}
