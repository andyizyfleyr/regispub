import "server-only";
import { getConfig } from "@/lib/config";
import type { RuntimeConfig } from "@/lib/config/keys";
import { env } from "@/lib/env";
import { FedapayProvider } from "./fedapay";
import { SandboxProvider } from "./sandbox";
import type { PaymentProvider } from "./types";

const allowed = (config: RuntimeConfig) => !env.isProd || config.allowSandboxPayments;

export async function sandboxAllowed() {
  return allowed(await getConfig());
}

/** Hors production, FEDAPAY_API_BASE permet de viser un faux serveur FedaPay pour les essais. Ignoré en production. */
export function fedapayFrom(config: RuntimeConfig) {
  const apiBase = env.isProd ? undefined : process.env.FEDAPAY_API_BASE?.replace(/\/+$/, "") || undefined;
  return new FedapayProvider({ secretKey: config.fedapaySecretKey, webhookSecret: config.fedapayWebhookSecret, environment: config.fedapayEnv, apiBase });
}

function build(id: string, config: RuntimeConfig): PaymentProvider | null {
  if (id === "fedapay") return fedapayFrom(config);
  if (id === "sandbox") return allowed(config) ? new SandboxProvider(env.appSecret) : null;
  return null;
}

/** Prestataire utilisé pour les nouveaux paiements, ou null si aucun n'est opérationnel. */
export async function getActiveProvider(): Promise<PaymentProvider | null> {
  const config = await getConfig();
  const provider = build(config.paymentProvider, config);
  return provider?.isConfigured() ? provider : null;
}

/** Prestataire d'un paiement existant ou d'un webhook entrant (peut différer du prestataire actif). */
export async function getProviderById(id: string): Promise<PaymentProvider | null> {
  return build(id, await getConfig());
}
