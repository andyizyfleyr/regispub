import { MarketingFooter, MarketingHeader } from "@/components/marketing/chrome";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter supportWhatsapp={settings.supportWhatsapp} supportEmail={settings.supportEmail} />
    </>
  );
}
