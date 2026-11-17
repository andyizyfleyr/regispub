import "server-only";
import { env } from "@/lib/env";

export type ChannelResult = { status: "SENT" | "FAILED" | "SKIPPED"; detail?: string; providerRef?: string };

export interface EmailChannel { isConfigured(): boolean; send(to: string, subject: string, text: string, html: string): Promise<ChannelResult> }
export interface WhatsappChannel { isConfigured(): boolean; send(toE164: string, text: string): Promise<ChannelResult> }

/** E-mails transactionnels via l'API Resend. */
export const resendEmail: EmailChannel = {
  isConfigured: () => env.emailProvider === "resend" && Boolean(env.resendKey),
  async send(to, subject, text, html) {
    if (!this.isConfigured()) return { status: "SKIPPED", detail: "Fournisseur d'e-mail non configuré" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.emailFrom, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      return res.ok ? { status: "SENT", providerRef: json.id } : { status: "FAILED", detail: json.message ?? `HTTP ${res.status}` };
    } catch (error) {
      return { status: "FAILED", detail: (error as Error).message };
    }
  },
};

/**
 * WhatsApp Cloud API (Meta). Hors fenêtre de conversation de 24 h, seuls les modèles approuvés par Meta
 * peuvent être envoyés : le texte est passé comme unique variable du corps du modèle configuré.
 */
export const whatsappCloud: WhatsappChannel = {
  isConfigured: () => { const w = env.whatsapp; return Boolean(w.phoneNumberId && w.accessToken && w.templateName); },
  async send(toE164, text) {
    if (!this.isConfigured()) return { status: "SKIPPED", detail: "WhatsApp Cloud API non configurée" };
    const w = env.whatsapp;
    try {
      const res = await fetch(`https://graph.facebook.com/${env.meta.apiVersion}/${w.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${w.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: toE164.replace(/^\+/, ""), type: "template",
          template: { name: w.templateName, language: { code: w.templateLang }, components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s+/g, " ").slice(0, 900) }] }] },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      return res.ok ? { status: "SENT", providerRef: json.messages?.[0]?.id } : { status: "FAILED", detail: json.error?.message ?? `HTTP ${res.status}` };
    } catch (error) {
      return { status: "FAILED", detail: (error as Error).message };
    }
  },
};
