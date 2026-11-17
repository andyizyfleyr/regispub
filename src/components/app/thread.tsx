"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/form";
import { cn, formatDateTime } from "@/lib/utils";
import { markCampaignReadAction, postMessageAction } from "@/server/actions/campaigns";

export type ThreadMessage = { id: string; body: string; internal: boolean; createdAt: string; mine: boolean; author: string; role: string | null };

/** Fil d'échanges d'une campagne, partagé entre l'espace client et le back-office. */
export function Thread({ campaignId, messages, canPost, allowInternal, disabledReason }: { campaignId: string; messages: ThreadMessage[]; canPost: boolean; allowInternal?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { void markCampaignReadAction(campaignId).catch(() => undefined); }, [campaignId, messages.length]);
  React.useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  React.useEffect(() => {
    // Rafraîchissement léger tant que l'onglet est visible.
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 20_000);
    return () => clearInterval(t);
  }, [router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const res = await postMessageAction(campaignId, body, internal);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[60vh] min-h-40 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-muted"><MessagesSquare className="mx-auto mb-2 size-6 text-line-strong" />Aucun message pour le moment.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm sm:max-w-[70%]", m.internal ? "border border-dashed border-marigold bg-marigold-soft text-ink" : m.mine ? "bg-forest text-white" : "border border-line bg-paper text-ink")}>
              <p className={cn("mb-1 flex items-center gap-1.5 text-xs", m.mine && !m.internal ? "text-white/70" : "text-muted")}>
                {m.internal && <Lock className="size-3" />}
                <span className="font-medium">{m.mine ? "Vous" : m.author}</span>{m.role && !m.mine ? <span>· {m.role}</span> : null}
                {m.internal && <span>· note interne</span>}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[11px]", m.mine && !m.internal ? "text-white/60" : "text-muted")}>{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canPost ? (
        <form onSubmit={send} className="border-t border-line p-3 sm:p-4">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} placeholder={internal ? "Note interne, invisible pour le client…" : "Votre message…"} aria-label="Message"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(e); }} className={internal ? "border-marigold bg-marigold-soft" : ""} />
          <div className="mt-2 flex items-center justify-between gap-3">
            {allowInternal ? (
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft"><Switch checked={internal} onCheckedChange={setInternal} aria-label="Note interne" />Note interne</label>
            ) : <span className="text-xs text-muted">Réponse sous 24 h ouvrées.</span>}
            <Button type="submit" size="sm" disabled={busy || !body.trim()}><Send />{busy ? "Envoi…" : "Envoyer"}</Button>
          </div>
        </form>
      ) : <p className="border-t border-line px-5 py-4 text-[13px] text-muted">{disabledReason ?? "La messagerie est fermée pour cette campagne."}</p>}
    </div>
  );
}
