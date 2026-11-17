import "server-only";
import { env } from "@/lib/env";
import { aiStatus } from "@/lib/ai/service";
import { ADS_ADAPTERS } from "@/lib/ads/adapters";
import { notificationChannelsStatus } from "@/lib/notifications/service";
import { getActiveProvider, sandboxAllowed } from "@/lib/payments/registry";
import { s3Configured } from "@/lib/storage";

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
export function integrationsStatus(): Integration[] {
  const provider = getActiveProvider();
  const ai = aiStatus();
  const channels = notificationChannelsStatus();
  const fedapayReady = Boolean(env.fedapaySecretKey);
  return [
    provider?.id === "fedapay"
      ? { area: "Paiements", name: "FedaPay — MTN, Moov, Celtiis (Bénin)", state: "operational", detail: `Mode ${env.fedapayEnv === "live" ? "réel" : "test (sandbox FedaPay)"}. ${env.fedapayWebhookSecret ? "Webhook signé configuré." : "Secret de webhook absent : seule la vérification par interrogation fonctionne."}` }
      : { area: "Paiements", name: "FedaPay — MTN, Moov, Celtiis (Bénin)", state: "needs_config", detail: fedapayReady ? "Clé présente mais PAYMENT_PROVIDER n'est pas « fedapay »." : "Adaptateur implémenté. Renseignez FEDAPAY_SECRET_KEY et FEDAPAY_WEBHOOK_SECRET.", action: "Créer un compte marchand FedaPay (pièce d'identité + IFU), puis déclarer le webhook /api/webhooks/payments/fedapay." },
    ...(provider?.id === "sandbox" ? [{ area: "Paiements", name: "Simulateur de paiement", state: "simulation" as const, detail: "Aucun argent ne circule. À n'utiliser que pour les démonstrations et les tests." }] : []),
    ...(!provider && !sandboxAllowed() ? [{ area: "Paiements", name: "Paiement en ligne", state: "needs_config" as const, detail: "Aucun prestataire actif : les clients ne peuvent pas payer." }] : []),
    { area: "Paiements", name: "Remboursements automatiques", state: "planned", detail: "Les remboursements sont suivis dans l'application mais le transfert est effectué manuellement depuis le compte du prestataire." },
    { area: "Paiements", name: "Autres pays (Togo, Côte d'Ivoire, Sénégal…)", state: "planned", detail: "L'architecture le prévoit (opérateurs par pays) ; l'activation dépend des contrats avec les agrégateurs." },
    ai.text
      ? { area: "IA", name: "Génération de textes", state: "operational", detail: `Fournisseur : ${ai.text.provider} (${ai.text.model}).` }
      : { area: "IA", name: "Génération de textes", state: "needs_config", detail: "Sans fournisseur, l'assistant utilise des suggestions guidées (modèles), signalées comme telles.", action: "Définir AI_TEXT_PROVIDER (openai, anthropic ou gemini) et la clé correspondante." },
    ai.image
      ? { area: "IA", name: "Génération d'images", state: "operational", detail: `Fournisseur : ${ai.image.provider} (${ai.image.model}).` }
      : { area: "IA", name: "Génération d'images", state: "needs_config", detail: "Désactivée. Le studio créatif reste utilisable avec les images importées.", action: "Définir AI_IMAGE_PROVIDER=openai et OPENAI_API_KEY." },
    { area: "IA", name: "Génération de vidéos", state: "planned", detail: "Non proposée : l'assistant fournit des scripts et le client importe ses vidéos." },
    ADS_ADAPTERS.META.isConfigured()
      ? { area: "Publicité", name: "Meta — lecture des statistiques", state: "operational", detail: "Jeton configuré. Synchronisation depuis la fiche campagne ou la tâche planifiée." }
      : { area: "Publicité", name: "Meta — lecture des statistiques", state: "needs_authorization", detail: "Adaptateur implémenté (Insights API), non testé sans identifiants.", action: "Vérification de l'entreprise Meta, application avec l'autorisation ads_read, jeton d'utilisateur système (META_ACCESS_TOKEN)." },
    { area: "Publicité", name: "Meta — création de campagnes par API", state: "needs_authorization", detail: "Non implémenté. Les gestionnaires lancent les campagnes dans le Gestionnaire de publicités puis rattachent leur identifiant.", action: "Nécessite l'accès avancé ads_management (App Review) et un compte publicitaire au nom de l'agence." },
    ADS_ADAPTERS.TIKTOK.isConfigured()
      ? { area: "Publicité", name: "TikTok — lecture des statistiques", state: "operational", detail: "Jeton configuré. Synchronisation depuis la fiche campagne ou la tâche planifiée." }
      : { area: "Publicité", name: "TikTok — lecture des statistiques", state: "needs_authorization", detail: "Adaptateur implémenté (Reporting API v1.3), non testé sans identifiants.", action: "Compte TikTok for Business, application développeur approuvée, TIKTOK_ACCESS_TOKEN et TIKTOK_ADVERTISER_ID." },
    { area: "Publicité", name: "TikTok — création de campagnes par API", state: "needs_authorization", detail: "Non implémenté. Lancement manuel par les gestionnaires dans TikTok Ads Manager." },
    { area: "Publicité", name: "Import de rapports (CSV) et saisie manuelle", state: "operational", detail: "Les lignes importées ne sont visibles du client qu'après validation." },
    channels.email
      ? { area: "Notifications", name: "E-mails (Resend)", state: "operational", detail: `Expéditeur : ${env.emailFrom}.` }
      : { area: "Notifications", name: "E-mails (Resend)", state: "needs_config", detail: "Les e-mails ne partent pas ; chaque tentative est consignée comme « non envoyée ».", action: "Définir EMAIL_PROVIDER=resend, RESEND_API_KEY et EMAIL_FROM (domaine vérifié)." },
    channels.whatsapp
      ? { area: "Notifications", name: "WhatsApp Cloud API", state: "operational", detail: `Modèle : ${env.whatsapp.templateName}.` }
      : { area: "Notifications", name: "WhatsApp Cloud API", state: "needs_authorization", detail: "Adaptateur implémenté. Les messages ne partent pas tant qu'il n'est pas configuré.", action: "Compte WhatsApp Business vérifié, numéro enregistré et modèle de message approuvé par Meta." },
    { area: "Notifications", name: "Notifications dans l'application", state: "operational", detail: "Toujours actives." },
    env.storageDriver === "s3" && s3Configured()
      ? { area: "Stockage", name: "Stockage compatible S3", state: "operational", detail: `Bucket ${env.s3.bucket}.` }
      : { area: "Stockage", name: "Stockage compatible S3", state: "needs_config", detail: "Stockage sur disque local : adapté au développement, pas à un hébergement serverless (fichiers non persistants).", action: "Définir STORAGE_DRIVER=s3 et les variables S3_* (S3, Cloudflare R2, MinIO…)." },
  ];
}
