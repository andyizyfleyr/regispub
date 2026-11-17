import * as React from "react";
import {
  AtSign, Building2, CalendarDays, CirclePlay, ClipboardList, FileText, Gem, Megaphone, MessageCircle, MessagesSquare, Music2, PhoneCall,
  Radio, Rocket, ShoppingBag, Store, Tag, ThumbsUp, UserPlus, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformCode } from "@/lib/catalog/platforms";
import type { OperatorCode } from "@/lib/phone";

type SvgProps = React.SVGProps<SVGSVGElement>;

export function LogoMark({ className, ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden {...props}>
      <rect width="32" height="32" rx="10" fill="#0B2A1F" />
      <circle cx="10.5" cy="21.5" r="3" fill="#F8A81F" />
      <path d="M10.5 13.5a8 8 0 0 1 8 8" stroke="#F8A81F" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M10.5 7.5a14 14 0 0 1 14 14" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-[19px] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
        Regis<span className={light ? "text-marigold" : "text-green"}>Pub</span>
      </span>
    </span>
  );
}

export function FacebookIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 22v-8.2h2.75l.42-3.2H13.5V8.56c0-.93.26-1.56 1.59-1.56h1.7V4.14A22.6 22.6 0 0 0 14.31 4c-2.45 0-4.13 1.5-4.13 4.24v2.36H7.4v3.2h2.78V22h3.32Z" />
    </svg>
  );
}

export function InstagramIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TiktokIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M14.6 3h2.9c.2 1.9 1.5 3.6 3.5 3.9v3a7.3 7.3 0 0 1-3.5-1.1v6.5a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.9 2.5V3Z" />
    </svg>
  );
}

export function WhatsappIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3.5 20.5 4.8 16A8.5 8.5 0 1 1 8 19.2l-4.5 1.3Z" />
      <path d="M9 8.6c-.3 2.9 3.5 6.6 6.4 6.4l.9-1.5-2-1-.8.8c-1-.4-2-1.4-2.3-2.3l.8-.8-1-2L9 8.6Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const PLATFORM_ICON: Record<PlatformCode, (p: SvgProps) => React.ReactElement> = { FACEBOOK: FacebookIcon, INSTAGRAM: InstagramIcon, TIKTOK: TiktokIcon };
const PLATFORM_BG: Record<PlatformCode, string> = { FACEBOOK: "bg-[#1877F2] text-white", INSTAGRAM: "bg-[linear-gradient(45deg,#f9a825_0%,#ee2a7b_50%,#6228d7_100%)] text-white", TIKTOK: "bg-[#111] text-white" };

export function PlatformIcon({ platform, className }: { platform: PlatformCode; className?: string }) {
  const Icon = PLATFORM_ICON[platform];
  return <Icon className={cn("size-4", className)} />;
}

export function PlatformBadge({ platform, size = "md" }: { platform: PlatformCode; size?: "sm" | "md" | "lg" }) {
  const Icon = PLATFORM_ICON[platform];
  const dims = size === "lg" ? "size-10 [&_svg]:size-5 rounded-lg" : size === "sm" ? "size-6 [&_svg]:size-3.5 rounded-md" : "size-8 [&_svg]:size-4 rounded-md";
  return <span className={cn("inline-flex shrink-0 items-center justify-center", dims, PLATFORM_BG[platform])}><Icon /></span>;
}

export function PlatformStack({ platforms, size = "sm" }: { platforms: PlatformCode[]; size?: "sm" | "md" }) {
  return <span className="inline-flex items-center gap-1">{platforms.map((p) => <PlatformBadge key={p} platform={p} size={size} />)}</span>;
}

const OPERATOR_STYLE: Record<OperatorCode, { cls: string; short: string }> = {
  MTN: { cls: "bg-[#FFCB05] text-[#0b2a4a]", short: "MTN" },
  MOOV: { cls: "bg-[#0056A4] text-white", short: "Moov" },
  CELTIIS: { cls: "bg-[#0B8F6A] text-white", short: "Celtiis" },
};

export function OperatorChip({ operator, className }: { operator: OperatorCode; className?: string }) {
  const s = OPERATOR_STYLE[operator];
  return <span className={cn("inline-flex h-7 min-w-12 items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase tracking-wide", s.cls, className)}>{s.short}</span>;
}

const OBJECTIVE_ICONS: Record<string, LucideIcon> = {
  ThumbsUp, UserPlus, AtSign, Music2, MessagesSquare, Megaphone, ShoppingBag, MessageCircle, ClipboardList, PhoneCall, Store, Tag, FileText,
  Building2, Radio, PlayCircle: CirclePlay, CalendarDays, Rocket, Gem,
};

export function ObjectiveIcon({ name, className }: { name: string; className?: string }) {
  const Icon = OBJECTIVE_ICONS[name] ?? Megaphone;
  return <Icon className={className} />;
}
