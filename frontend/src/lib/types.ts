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
  created_at: string;
}

export type AdType = "image" | "html" | "cta";

export interface AdSlot {
  id: string;
  site_id: string;
  type: AdType;
  title: string;
  badge: string;
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
  created_at: string;
}

export interface PublicSite {
  site: Site;
  slots: AdSlot[];
}

export interface AdminUser {
  username: string;
}

export const DEFAULT_THEME: Theme = {
  bg: "#090B10",
  panel: "#121620",
  card: "#0D1017",
  accent: "#22C55E",
  accent2: "#FACC15",
  text: "#F1F5F9",
};

export const AD_TYPE_LABELS: Record<string, string> = {
  image: "Marka / Logo Kartı",
  html: "HTML / Embed",
  cta: "Metin & CTA Kartı",
};

// Neon border palette used by the tuna40-style cards and the pop-up grid.
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
