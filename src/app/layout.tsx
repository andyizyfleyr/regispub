import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/geist-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RegisPub — Votre publicité Facebook, Instagram et TikTok, payée par Mobile Money", template: "%s · RegisPub" },
  description: "Créez, financez et suivez vos campagnes publicitaires sur Facebook, Instagram et TikTok sans carte bancaire. Paiement MTN Mobile Money, Moov Money et Celtiis Cash.",
  applicationName: "RegisPub",
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 14, boxShadow: "var(--shadow-pop)", border: "1px solid var(--color-line)" } }} />
      </body>
    </html>
  );
}
