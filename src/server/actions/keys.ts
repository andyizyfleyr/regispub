"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { getConfig, KeysError, saveKeys } from "@/lib/config";
import { KEY_NAMES, keyDef } from "@/lib/config/keys";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { FEDAPAY_TEST_NUMBERS } from "@/lib/payments/fedapay";
import { fedapayFrom } from "@/lib/payments/registry";
import { PaymentProviderError } from "@/lib/payments/types";
import { groupDigits } from "@/lib/phone";
import { formatDateTime } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { formAction, safeAction, UserError } from "@/server/action";

const log = createLogger("keys");

const many = z.union([z.string(), z.array(z.string())]);

/**
 * Enregistre les clés des services externes saisies dans l'administration.
 * Réservé au super administrateur. Le journal d'audit garde le nom des clés modifiées, jamais leur valeur.
 */
export const saveKeysAction = formAction(z.record(z.string(), many), async (input) => {
  const actor = await assertPermission("keys.manage");
  if (!(await rateLimit(`keys:${actor.id}`, 30, 600))) throw new UserError("Trop de modifications en peu de temps. Réessayez dans quelques minutes.");

  const values: Record<string, string> = {};
  for (const name of KEY_NAMES) {
    const raw = input[name];
    if (typeof raw === "string") values[name] = raw;
  }
  const clear = [input.clear ?? []].flat().filter((name) => keyDef(name)?.secret);

  let changed: string[];
  try {
    changed = await saveKeys({ values, clear }, actor.id);
  } catch (error) {
    if (error instanceof KeysError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    throw error;
  }
  if (!changed.length) return { ok: true, message: "Aucun changement." };
  await audit({ actorId: actor.id, action: "keys.updated", entity: "AppKey", meta: { changed } });
  return { ok: true, message: "Clés enregistrées. Elles sont prises en compte en quelques secondes." };
});

export type CheckLine = { tone: "ok" | "warn" | "danger"; text: string };

/**
 * Essai réel des clés FedaPay enregistrées : la clé est-elle acceptée, le webhook est-il déclaré et actif,
 * les notifications reçues sont-elles bien signées ? Aucun paiement n'est créé.
 */
export async function testFedapayAction() {
  return safeAction(async () => {
    const actor = await assertPermission("keys.manage");
    if (!(await rateLimit(`keys-test:${actor.id}`, 20, 600))) throw new UserError("Trop d'essais en peu de temps. Réessayez dans quelques minutes.");
    const config = await getConfig();
    if (!config.fedapaySecretKey) throw new UserError("Enregistrez d'abord la clé secrète FedaPay.");
    const modeLabel = config.fedapayEnv === "live" ? "réel" : "test";
    const webhookUrl = `${env.appUrl}/api/webhooks/payments/fedapay`;
    const lines: CheckLine[] = [];

    try {
      const provider = fedapayFrom(config);
      const result = await provider.diagnose(webhookUrl);
      lines.push({ tone: "ok", text: `Clé acceptée par FedaPay en mode ${modeLabel}.` });
      if (config.fedapayEnv !== "live") lines.push({ tone: "warn", text: `Mode test : aucun argent réel n'est encaissé et seuls les numéros ${FEDAPAY_TEST_NUMBERS.map(groupDigits).join(" et ")} sont acceptés, tout autre numéro est refusé. Pour encaisser de vrais paiements, choisissez le mode « Réel » avec la clé secrète et le webhook du mode réel.` });
      if (result.webhook === "active") lines.push({ tone: "ok", text: "FedaPay a bien un webhook actif vers ce site." });
      if (result.webhook === "disabled") lines.push({ tone: "danger", text: "Le webhook vers ce site est désactivé chez FedaPay. Réactivez-le dans votre compte FedaPay, menu « Webhooks »." });
      if (result.webhook === "missing") lines.push({ tone: "danger", text: `Aucun webhook ne pointe vers ce site. Dans votre compte FedaPay (mode ${modeLabel}), menu « Webhooks », créez-en un avec cette adresse : ${webhookUrl}` });
      if (result.webhook === "unknown") lines.push({ tone: "warn", text: `La liste des webhooks n'a pas pu être lue. Vérifiez dans votre compte FedaPay qu'un webhook pointe vers : ${webhookUrl}` });
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error;
      log.warn("essai FedaPay en échec", { kind: error.kind, reason: error.message });
      if (error.kind === "auth") lines.push({ tone: "danger", text: `FedaPay refuse cette clé en mode ${modeLabel}. Vérifiez que c'est bien la clé secrète (elle commence par « sk_ ») et que le mode choisi est celui de la clé.` });
      else if (error.kind === "unavailable") lines.push({ tone: "warn", text: "FedaPay ne répond pas pour le moment. Réessayez dans un instant." });
      else lines.push({ tone: "danger", text: `FedaPay a répondu par une erreur : ${error.message.slice(0, 300)}` });
      return { lines };
    }

    if (!config.fedapayWebhookSecret) {
      lines.push({ tone: "warn", text: "Le secret du webhook n'est pas enregistré ici : les notifications de FedaPay sont refusées, et un paiement n'est confirmé que si le client garde la page ouverte ou au passage de la vérification quotidienne." });
    } else {
      const week = new Date(Date.now() - 7 * 86_400_000);
      const [rejected, last] = await Promise.all([
        db.paymentEvent.count({ where: { provider: "fedapay", signatureValid: false, receivedAt: { gte: week } } }),
        db.paymentEvent.findFirst({ where: { provider: "fedapay", signatureValid: true }, orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
      ]);
      if (last) lines.push({ tone: "ok", text: `Dernière notification de FedaPay reçue et reconnue le ${formatDateTime(last.receivedAt)}.` });
      else lines.push({ tone: "warn", text: "Aucune notification de FedaPay n'a encore été reçue. C'est normal tant qu'aucun paiement n'a été fait dans ce mode." });
      if (rejected > 0) lines.push({ tone: "warn", text: `${rejected} notification${rejected > 1 ? "s" : ""} refusée${rejected > 1 ? "s" : ""} ces 7 derniers jours pour signature incorrecte. Si elles venaient de FedaPay, le secret du webhook enregistré ici n'est pas celui que FedaPay affiche pour ce webhook.` });
    }
    await audit({ actorId: actor.id, action: "keys.tested", entity: "AppKey", meta: { service: "fedapay", mode: config.fedapayEnv, result: lines.map((l) => l.tone) } });
    return { lines };
  });
}
