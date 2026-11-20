import "server-only";
import { getConfig } from "@/lib/config";
import { s3Complete } from "@/lib/config/keys";
import { env } from "@/lib/env";
import { ADS_ADAPTERS } from "@/lib/ads/adapters";
import { notificationChannelsStatus } from "@/lib/notifications/service";
import { getActiveProvider, sandboxAllowed } from "@/lib/payments/registry";

const KEYS_PAGE = "Gestion → Paramètres → Clés et connexions";

export type IntegrationState = "operational" | "simulation" | "needs_config" | "needs_authorization" | "planned";

export type Integration = { area: string; name: string; state: IntegrationState; detail: string; action?: string };

export const STATE_LABELS: Record<IntegrationState, string> = {
  operational: "Opérationnel",
  simulation: "Simulation",
  needs_config: "À configurer",
  needs_authorization: "Autorisation requise",
  planned: "En attente",
};

/** État réel de chaque intégration externe. Affiché tel quel dans l'administration : rien n'est présenté comme actif s'il ne l'est pas. */
export async function integrationsStatus(): Promise<Integration[]> {
  const [config, provider, channels, sandbox, metaReady, tiktokReady] = await Promise.all([
    getConfig(), getActiveProvider(), notificationChannelsStatus(), sandboxAllowed(), ADS_ADAPTERS.META.isConfigured(), ADS_ADAPTERS.TIKTOK.isConfigured(),
  ]);
  const fedapayReady = Boolean(config.fedapaySecretKey);
  return [
    provider?.id === "fedapay"
      ? { area: "Paiements", name: "FedaPay — MTN, Moov, Celtiis (Bénin)", state: "operational", detail: `Mode ${config.fedapayEnv === "live" ? "réel" : "test : aucun débit, et la page de paiement FedaPay n'accepte que les numéros 01 64 00 00 01 et 01 66 00 00 01"}. ${config.fedapayWebhookSecret ? "Secret du webhook enregistré." : "Secret du webhook absent : un paiement n'est confirmé que si le client garde la page ouverte, ou au passage de la vérification quotidienne."} Le bouton « Tester FedaPay » de ${KEYS_PAGE} vérifie la clé et le webhook.` }
      : { area: "Paiements", name: "FedaPay — MTN, Moov, Celtiis (Bénin)", state: "needs_config", detail: fedapayReady ? "La clé est enregistrée mais le prestataire choisi n'est pas FedaPay." : "Il manque la clé secrète FedaPay.", action: `Créer un compte marchand FedaPay (pièce d'identité + IFU), saisir ses clés dans ${KEYS_PAGE}, puis déclarer le webhook /api/webhooks/payments/fedapay.` },
    ...(provider?.id === "sandbox" ? [{ area: "Paiements", name: "Simulateur de paiement", state: "simulation" as const, detail: "Aucun argent ne circule. À n'utiliser que pour les démonstrations et les tests." }] : []),
    ...(!provider && !sandbox ? [{ area: "Paiements", name: "Paiement en ligne", state: "needs_config" as const, detail: "Aucun prestataire actif : les clients ne peuvent pas payer." }] : []),
    { area: "Paiements", name: "Remboursements automatiques", state: "planned", detail: "Les remboursements sont suivis dans l'application mais le transfert est effectué manuellement depuis le compte du prestataire." },
    { area: "Paiements", name: "Autres pays (Togo, Côte d'Ivoire, Sénégal…)", state: "planned", detail: "L'architecture le prévoit (opérateurs par pays) ; l'activation dépend des contrats avec les agrégateurs." },
    metaReady
      ? { area: "Publicité", name: "Meta — lecture des statistiques", state: "operational", detail: "Jeton configuré. Synchronisation depuis la fiche campagne ou la tâche planifiée." }
      : { area: "Publicité", name: "Meta — lecture des statistiques", state: "needs_authorization", detail: "Adaptateur implémenté (Insights API), non testé sans identifiants.", action: `Vérification de l'entreprise Meta, application avec l'autorisation ads_read, puis jeton d'utilisateur système à saisir dans ${KEYS_PAGE}.` },
    { area: "Publicité", name: "Meta — création de campagnes par API", state: "needs_authorization", detail: "Non implémenté. Les gestionnaires lancent les campagnes dans le Gestionnaire de publicités puis rattachent leur identifiant.", action: "Nécessite l'accès avancé ads_management (App Review) et un compte publicitaire au nom de l'agence." },
    tiktokReady
      ? { area: "Publicité", name: "TikTok — lecture des statistiques", state: "operational", detail: "Jeton configuré. Synchronisation depuis la fiche campagne ou la tâche planifiée." }
      : { area: "Publicité", name: "TikTok — lecture des statistiques", state: "needs_authorization", detail: "Adaptateur implémenté (Reporting API v1.3), non testé sans identifiants.", action: `Compte TikTok for Business, application développeur approuvée, puis jeton et identifiant annonceur à saisir dans ${KEYS_PAGE}.` },
    { area: "Publicité", name: "TikTok — création de campagnes par API", state: "needs_authorization", detail: "Non implémenté. Lancement manuel par les gestionnaires dans TikTok Ads Manager." },
    { area: "Publicité", name: "Import de rapports (CSV) et saisie manuelle", state: "operational", detail: "Les lignes importées ne sont visibles du client qu'après validation." },
    channels.email
      ? { area: "Notifications", name: "E-mails (Resend)", state: "operational", detail: `Expéditeur : ${config.emailFrom}.` }
      : { area: "Notifications", name: "E-mails (Resend)", state: "needs_config", detail: "Les e-mails ne partent pas ; chaque tentative est consignée comme « non envoyée ».", action: `Créer un compte Resend, vérifier votre domaine, puis saisir la clé et l'expéditeur dans ${KEYS_PAGE}.` },
    channels.whatsapp
      ? { area: "Notifications", name: "WhatsApp Cloud API", state: "operational", detail: `Modèle : ${config.whatsapp.templateName}.` }
      : { area: "Notifications", name: "WhatsApp Cloud API", state: "needs_authorization", detail: "Adaptateur implémenté. Les messages ne partent pas tant qu'il n'est pas configuré.", action: `Compte WhatsApp Business vérifié, numéro enregistré et modèle de message approuvé par Meta, puis saisie dans ${KEYS_PAGE}.` },
    { area: "Notifications", name: "Notifications dans l'application", state: "operational", detail: "Toujours actives." },
    config.storageDriver === "s3" && s3Complete(config)
      ? { area: "Stockage", name: "Stockage compatible S3", state: "operational", detail: `Bucket ${config.s3.bucket}.` }
      : { area: "Stockage", name: "Stockage compatible S3", state: "needs_config", detail: env.readOnlyFs ? "Aucun stockage configuré : l'envoi de fichiers (photos, vidéos, créations) est désactivé sur ce site." : "Stockage sur disque local : adapté au développement, pas à un hébergement serverless (fichiers non persistants).", action: `Créer un espace compatible S3 (Cloudflare R2, Backblaze, Amazon S3…), puis saisir ses clés dans ${KEYS_PAGE}.` },
  ];
}
