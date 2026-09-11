// Hand-written mirrors of backend/models/schemas.py — keep both sides in sync.

export interface Theme {
  bg: string;
  panel: string;
  card: string;
  accent: string;
  accent2: string;
  text: string;
}

export interface Popup {
  enabled: boolean;
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_url: string;
  countdown_seconds: number;
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
  image_url: string;
  target_url: string;
  html: string;
  cta_text: string;
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
  card: "#181E2C",
  accent: "#F59E0B",
  accent2: "#06B6D4",
  text: "#F1F5F9",
};

export const DEFAULT_POPUP: Popup = {
  enabled: true,
  title: "HOŞ GELDİN BONUSU",
  subtitle: "İlk üyeliğe özel %200 hoş geldin bonusu seni bekliyor.",
  image_url: "",
  cta_text: "BONUSU AL",
  cta_url: "#",
  countdown_seconds: 60,
};

export const AD_TYPE_LABELS: Record<string, string> = {
  image: "Görsel Banner",
  html: "HTML / Embed",
  cta: "Metin & CTA Kartı",
};
