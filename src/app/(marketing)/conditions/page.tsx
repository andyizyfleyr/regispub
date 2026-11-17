import type { Metadata } from "next";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

const SECTIONS = [
  ["Objet du service", "RegisPub est un prestataire de services publicitaires. Nous créons, configurons, finançons auprès des plateformes et suivons des campagnes sur Facebook, Instagram et TikTok pour le compte de nos clients, qui nous règlent par Mobile Money."],
  ["Budget publicitaire et frais de prestation", "Chaque commande distingue le budget publicitaire, intégralement reversé aux plateformes, des frais de prestation qui rémunèrent notre travail. Aucune prestation n'est facturée moins de 10 000 FCFA. Les éventuels frais de paiement sont indiqués avant validation."],
  ["Absence de garantie de résultat", "Les performances d'une campagne dépendent de facteurs que nous ne maîtrisons pas (offre, prix, concurrence, saison, décisions des plateformes). Nous ne garantissons aucun nombre d'abonnés, de vues, de prospects ou de ventes. Nous nous engageons à mettre en œuvre les moyens convenus et à rendre compte de manière transparente."],
  ["Règles des plateformes", "Les annonces doivent respecter les politiques publicitaires de Meta et de TikTok. Nous pouvons refuser ou modifier un contenu non conforme (produits interdits, allégations trompeuses, contenus discriminatoires, etc.). Une annonce peut être rejetée par une plateforme indépendamment de notre volonté ; nous proposons alors une correction."],
  ["Paiements", "Un paiement n'est considéré comme reçu qu'après confirmation par notre prestataire de paiement. Une capture d'écran ne constitue pas une preuve de paiement. En cas de double débit constaté, le montant excédentaire est remboursé."],
  ["Annulation et remboursement", "Une commande non payée peut être annulée librement. Après paiement, le budget publicitaire non encore dépensé peut être remboursé sur demande ; les frais de prestation restent dus dès lors que le travail a commencé. Chaque demande est étudiée par notre support."],
  ["Contenus fournis par le client", "Vous garantissez détenir les droits sur les images, vidéos, textes et marques que vous nous transmettez, et nous autorisez à les utiliser pour vos campagnes."],
  ["Données personnelles", "Nous collectons les informations nécessaires à la gestion de votre compte et de vos campagnes (identité, coordonnées, numéro Mobile Money utilisé pour le paiement). Elles ne sont ni vendues ni cédées. Vous pouvez demander leur rectification ou leur suppression auprès du support."],
] as const;

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <h1 className="text-[2.25rem] font-semibold leading-tight">Conditions d&apos;utilisation</h1>
      <Notice tone="warn" className="mt-6" title="Modèle à faire valider">Ce texte est un modèle de départ. Il doit être relu et adapté par un juriste avant l&apos;ouverture commerciale du service.</Notice>
      <div className="mt-10 space-y-8">
        {SECTIONS.map(([title, body], i) => (
          <section key={title}>
            <h2 className="text-xl font-semibold">{i + 1}. {title}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
