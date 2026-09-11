// Hand-written mirrors of backend/models/schemas.py — keep both sides in sync.

export interface Theme {
  bg: string;
  panel: string;
  card: string;
  accent: string;
  accent2: string;
  text: string;
}

export interface PopupItem {
  id: string;
  brand_name: string;
  logo_url: string;
  line1: string;
  line2: string;
  url: string;
  border_color: string;
  col_span: number;
  order: number;
}

export interface Popup {
  enabled: boolean;
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_url: string;
  countdown_seconds: number;
  columns: number;
  items: PopupItem[];
}

export interface Site {
  id: string;
  slug: string;
  name: string;
  domains: string[];
  title: string;
  tagline: string;
  logo_text: string;
  hero_image_url: string;
  marquee: string[];
  columns: number;
  theme: Theme;
  popup: Popup;
  custom_css: string;
  active: boolean;
  is_default: boolean;
  created_at: string;
}

export type AdType = "image" | "html" | "cta";
export type BadgePosition = "left" | "center" | "right";
export type BadgeStyle = "tab" | "corner" | "strip" | "ribbon";
export type TextSize = "sm" | "md" | "lg";
export type CardEffect = "none" | "glow" | "sweep" | "aurora" | "border";
export type LinkStatus = "unknown" | "ok" | "redirect" | "broken" | "dead";

export interface AdSlot {
  id: string;
  site_id: string;
  type: AdType;
  title: string;
  badge: string;
  badge_position: BadgePosition;
  badge_style: BadgeStyle;
  badge_bg: string;
  badge_text_color: string;
  text_size: TextSize;
  effect: CardEffect;
  effect_speed: number;
  description: string;
  line2: string;
  image_url: string;
  target_url: string;
  html: string;
  cta_text: string;
  border_color: string;
  col_span: number;
  height: number;
  order: number;
  active: boolean;
  clicks: number;
  link_status: LinkStatus;
  link_http_status: number;
  link_final_url: string;
  link_checked_at: string | null;
  created_at: string;
}

export interface DailyPoint {
  day: string;
  clicks: number;
}

export interface SlotStat {
  slot_id: string;
  title: string;
  badge: string;
  border_color: string;
  clicks_total: number;
  clicks_range: number;
}

export interface SiteStats {
  days: number;
  total_clicks: number;
  range_clicks: number;
  daily: DailyPoint[];
  slots: SlotStat[];
  per_slot_daily: Record<string, DailyPoint[]>;
}

export interface LinkCheckResult {
  slot_id: string;
  title: string;
  target_url: string;
  link_status: LinkStatus;
  link_http_status: number;
  link_final_url: string;
}

export interface LinkCheckSummary {
  checked: number;
  ok: number;
  problems: number;
  results: LinkCheckResult[];
}

export const CARD_EFFECT_LABELS: Record<string, string> = {
  none: "Kapalı",
  glow: "Parlama",
  sweep: "Kayan Işık",
  aurora: "Renk Geçişi",
  border: "Dönen Çerçeve",
};

export const LINK_STATUS_LABELS: Record<string, string> = {
  unknown: "Kontrol edilmedi",
  ok: "Çalışıyor",
  redirect: "Yönlendirme",
  broken: "Bozuk yönlendirme",
  dead: "Ölü link",
};

export interface PublicSite {
  site: Site;
  slots: AdSlot[];
}

export interface AdminUser {
  username: string;
}

export interface UploadResult {
  url: string;
}

export interface UploadItem {
  id: string;
  url: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

export const DEFAULT_THEME: Theme = {
  bg: "#090B10",
  panel: "#121620",
  card: "#0D1017",
  accent: "#22C55E",
  accent2: "#FACC15",
  text: "#F1F5F9",
};

export const BADGE_POSITION_LABELS: Record<string, string> = {
  left: "Sol Üst",
  center: "Orta Üst",
  right: "Sağ Üst",
};

export const BADGE_STYLE_LABELS: Record<string, string> = {
  tab: "Sekme",
  corner: "Köşe",
  strip: "Şerit",
  ribbon: "Kurdele",
};

export const TEXT_SIZE_LABELS: Record<string, string> = {
  sm: "Küçük",
  md: "Orta",
  lg: "Büyük",
};

// Kart yazı ölçekleri: [mobil başlık, masaüstü başlık, mobil satır, masaüstü satır]
export const TEXT_SIZE_CLASSES: Record<string, { title: string; line: string }> = {
  sm: { title: "text-[11px] sm:text-base", line: "text-[9px] sm:text-[10px]" },
  md: { title: "text-[13px] sm:text-xl", line: "text-[10px] sm:text-[11px]" },
  lg: { title: "text-[16px] sm:text-2xl", line: "text-[12px] sm:text-[13px]" },
};

export const AD_TYPE_LABELS: Record<string, string> = {
  image: "Marka / Logo Kartı",
  html: "HTML / Embed",
  cta: "Metin & CTA Kartı",
};

// Neon border palette used by the marco-style cards and the pop-up grid.
export const NEON_COLORS = [
  "#22C55E",
  "#FACC15",
  "#F97316",
  "#A855F7",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];
