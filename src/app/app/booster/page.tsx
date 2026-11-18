import type { Metadata } from "next";
import { BoostForm } from "@/components/app/boost-form";
import { BOOST_KIND_ICONS, BOOST_KIND_TONES } from "@/components/app/boost-icons";
import { StateIcon } from "@/components/ui/badge";
import { List, ListRow, SectionTitle } from "@/components/ui/list";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { boostLabel, isBoostKind, type BoostKindCode } from "@/lib/boost/catalog";
import { loadBoostProducts } from "@/lib/boost/service";
import { PLATFORM_CODES, type PlatformCode } from "@/lib/catalog/platforms";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDate, formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Abonnés, J'aime, vues" };

export default async function BoostPage({ searchParams }: { searchParams: Promise<{ reseau?: string; type?: string }> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const [products, settings, orders] = await Promise.all([
    loadBoostProducts({ activeOnly: true }),
    getSettings(),
    db.boostOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { order: { select: { total: true, status: true } } } }),
  ]);
  const platform = PLATFORM_CODES.find((p) => p.toLowerCase() === sp.reseau?.toLowerCase());
  const kind = sp.type ? sp.type.toUpperCase() : undefined;

  return (
    <div className="space-y-8">
      <PageHeader title="Abonnés, J'aime, vues" description="Choisissez, collez votre lien, payez. Nous livrons." />
      {products.length ? (
        <BoostForm products={products} fees={{ paymentFeePercent: settings.paymentFeePercent, paymentFeePayer: settings.paymentFeePayer }} initial={{ platform, kind: isBoostKind(kind) ? kind : undefined }} />
      ) : <EmptyState art="box" title="Bientôt disponible" description="Ces produits ne sont pas proposés pour le moment." />}

      {orders.length > 0 && (
        <section aria-labelledby="boost-commandes">
          <SectionTitle id="boost-commandes">Vos commandes</SectionTitle>
          <List>
            {orders.map((b) => {
              const k = b.kind as BoostKindCode;
              const Icon = BOOST_KIND_ICONS[k];
              // Une commande annulée ou remboursée garde son état de commande ; sinon on montre où en est la livraison.
              const closed = b.order.status === "CANCELLED" || b.order.status === "EXPIRED" || b.order.status === "REFUNDED";
              return (
                <ListRow key={b.id} href={`/app/paiements/${b.orderId}`} icon={<Icon />} tone={BOOST_KIND_TONES[k]} title={boostLabel(b.platform as PlatformCode, k, b.quantity)}
                  subtitle={formatDate(b.createdAt)} value={<span className="tnum font-semibold text-ink">{formatFcfa(b.order.total)}</span>}
                  meta={closed ? <StateIcon kind="order" value={b.order.status} /> : <StateIcon kind="boost" value={b.status} />} />
              );
            })}
          </List>
        </section>
      )}
    </div>
  );
}
