import { Ellipsis, Heart, MessageCircle, Music2, Send, ThumbsUp } from "lucide-react";
import type { PlatformCode } from "@/lib/catalog/platforms";
import { initials } from "@/lib/utils";

type Copy = { headline: string; body: string; cta: string } | null;

function Media({ imageId, ratio }: { imageId: string | null; ratio: string }) {
  return (
    <div className="bg-sand" style={{ aspectRatio: ratio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imageId ? <img src={`/api/files/${imageId}`} alt="Visuel de l'annonce" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-xs text-muted">Votre visuel</span>}
    </div>
  );
}

/** Aperçu indicatif d'une annonce : reproduit la structure d'une publication sponsorisée, pas son rendu exact. */
export function AdPreview({ platform, pageName, copy, imageId }: { platform: PlatformCode; pageName: string; copy: Copy; imageId: string | null }) {
  const body = copy?.body || "Le texte principal de votre annonce apparaîtra ici.";
  const headline = copy?.headline || "Titre de l'annonce";
  const cta = copy?.cta || "En savoir plus";
  const avatar = <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{initials(pageName)}</span>;

  if (platform === "TIKTOK") {
    return (
      <div className="relative mx-auto max-w-[15rem] overflow-hidden rounded-xl bg-[#111] text-white">
        <div className="opacity-90"><Media imageId={imageId} ratio="9 / 16" /></div>
        <div className="absolute inset-x-0 bottom-0 bg-[#111]/70 p-3">
          <p className="text-[13px] font-semibold">@{pageName.toLowerCase().replace(/[^a-z0-9]+/g, "")} <span className="ml-1 rounded bg-white/20 px-1 text-[10px] font-normal">Sponsorisé</span></p>
          <p className="mt-1 line-clamp-2 text-xs text-white/90">{body}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/70"><Music2 className="size-3" />Son original</p>
          <span className="mt-2 block rounded bg-[#FE2C55] py-1.5 text-center text-xs font-semibold">{cta}</span>
        </div>
      </div>
    );
  }
  if (platform === "INSTAGRAM") {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2.5 p-3">{avatar}<div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-ink">{pageName}</p><p className="text-[11px] text-muted">Sponsorisé</p></div><Ellipsis className="size-4 text-muted" /></div>
        <Media imageId={imageId} ratio="1 / 1" />
        <div className="flex items-center justify-between bg-sand/70 px-3 py-2 text-[13px] font-medium text-ink">{cta}<span aria-hidden>›</span></div>
        <div className="p-3">
          <div className="flex gap-3 text-ink"><Heart className="size-5" /><MessageCircle className="size-5" /><Send className="size-5" /></div>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-[13px] text-ink-soft"><span className="font-semibold text-ink">{pageName}</span> {body}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2.5 p-3">{avatar}<div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-ink">{pageName}</p><p className="text-[11px] text-muted">Sponsorisé</p></div><Ellipsis className="size-4 text-muted" /></div>
      <p className="line-clamp-4 whitespace-pre-line px-3 pb-3 text-[13px] text-ink-soft">{body}</p>
      <Media imageId={imageId} ratio="1 / 1" />
      <div className="flex items-center justify-between gap-3 bg-sand/70 px-3 py-2.5">
        <p className="min-w-0 truncate text-[13px] font-semibold text-ink">{headline}</p>
        <span className="shrink-0 rounded-md bg-line px-2.5 py-1.5 text-xs font-semibold text-ink">{cta}</span>
      </div>
      <div className="flex justify-around border-t border-line py-2 text-xs text-muted"><span className="flex items-center gap-1.5"><ThumbsUp className="size-4" />J&apos;aime</span><span className="flex items-center gap-1.5"><MessageCircle className="size-4" />Commenter</span><span className="flex items-center gap-1.5"><Send className="size-4" />Partager</span></div>
    </div>
  );
}
