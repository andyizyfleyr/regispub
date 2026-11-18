// Pictogrammes et couleurs des quatre produits. Fichier sans « use client » : utilisable côté serveur comme côté navigateur.
import { Eye, Heart, MessageCircle, UserPlus, type LucideIcon } from "lucide-react";
import type { BoostKindCode } from "@/lib/boost/catalog";

export const BOOST_KIND_ICONS: Record<BoostKindCode, LucideIcon> = { FOLLOWERS: UserPlus, LIKES: Heart, COMMENTS: MessageCircle, VIEWS: Eye };
export const BOOST_KIND_TONES: Record<BoostKindCode, "green" | "rose" | "sky" | "violet"> = { FOLLOWERS: "green", LIKES: "rose", COMMENTS: "sky", VIEWS: "violet" };
