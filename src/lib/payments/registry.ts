import "server-only";
import { env } from "@/lib/env";
import { FedapayProvider } from "./fedapay";
import { SandboxProvider } from "./sandbox";
import type { PaymentProvider } from "./types";

export function sandboxAllowed() {
  return !env.isProd || env.allowSandboxPayments;
}

function build(id: string): PaymentProvider | null {
  if (id === "fedapay") return new FedapayProvider({ secretKey: env.fedapaySecretKey, webhookSecret: env.fedapayWebhookSecret, environment: env.fedapayEnv });
  if (id === "sandbox") return sandboxAllowed() ? new SandboxProvider(env.appSecret) : null;
  return null;
}

/** Prestataire utilisé pour les nouveaux paiements, ou null si aucun n'est opérationnel. */
export function getActiveProvider(): PaymentProvider | null {
  const provider = build(env.paymentProvider);
  return provider?.isConfigured() ? provider : null;
}

/** Prestataire d'un paiement existant ou d'un webhook entrant (peut différer du prestataire actif). */
export function getProviderById(id: string): PaymentProvider | null {
  return build(id);
}
