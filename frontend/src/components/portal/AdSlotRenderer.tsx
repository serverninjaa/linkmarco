import type { AdSlot } from "@/lib/types";
import { TEXT_SIZE_CLASSES } from "@/lib/types";
import { apiPost } from "@/lib/api";
import type { CSSProperties } from "react";

interface Props {
  slot: AdSlot;
  accent: string;
  cardBg: string;
}

// Kolon genişliği mobilde de aynı: masaüstündeki sıra ve yan yana görünüm korunur.
const SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
};

/** tuna40-style brand card: dark plate, neon border, corner brackets, logo + two bonus lines. */
export default function AdSlotRenderer({ slot, accent, cardBg }: Props) {
  const color = slot.border_color || accent;

  const go = () => {
    void apiPost(`/public/slots/${slot.id}/click`).catch(() => undefined);
    if (slot.target_url) window.open(slot.target_url, "_blank", "noopener");
  };

  const span = SPAN[slot.col_span] ?? "col-span-1";
  // Yükseklik mobilde oransal küçülür, sm ve üstünde panelde girilen değere döner.
  const heightVar = { "--card-h": `${slot.height}px` } as CSSProperties;
  const heightCls = "min-h-[calc(var(--card-h)*0.62)] sm:min-h-[var(--card-h)]";

  // Rozet renkleri panelden bağımsız seçilebilir; boşsa kartın neon rengi kullanılır.
  const badgeBg = slot.badge_bg || color;
  const badgeFg = slot.badge_text_color || "#000000";
  const sizeCls = TEXT_SIZE_CLASSES[slot.text_size] ?? TEXT_SIZE_CLASSES.md;
  const fxSpeed = { "--fx-speed": `${Math.max(1, slot.effect_speed || 6)}s` } as CSSProperties;

  // Kart arkası animasyonlu renk efekti (panelden aktif/pasif)
  const renderEffect = () => {
    if (!slot.effect || slot.effect === "none") return null;

    if (slot.effect === "glow") {
      return (
        <span
          aria-hidden
          className="card-fx-glow pointer-events-none absolute inset-0 z-0"
          style={{
            ...fxSpeed,
            background: `radial-gradient(circle at 50% 50%, ${color}80 0%, transparent 65%)`,
          }}
          data-testid="ad-card-effect"
        />
      );
    }

    if (slot.effect === "sweep") {
      return (
        <span aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" data-testid="ad-card-effect">
          <span
            className="card-fx-sweep absolute inset-y-0 w-1/3"
            style={{
              ...fxSpeed,
              background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
            }}
          />
        </span>
      );
    }

    if (slot.effect === "aurora") {
      return (
        <span
          aria-hidden
          className="card-fx-aurora pointer-events-none absolute inset-0 z-0 opacity-45"
          style={{
            ...fxSpeed,
            background: `linear-gradient(120deg, ${color}00, ${color}99, #ffffff26, ${color}66, ${color}00)`,
          }}
          data-testid="ad-card-effect"
        />
      );
    }

    // border: dönen konik çerçeve
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" data-testid="ad-card-effect">
        <span
          className="card-fx-border absolute left-1/2 top-1/2 h-[240%] w-[240%] -translate-x-1/2 -translate-y-1/2 opacity-60"
          style={{
            ...fxSpeed,
            background: `conic-gradient(from 0deg, transparent 0deg, ${color} 70deg, transparent 140deg, transparent 360deg)`,
          }}
        />
        <span className="absolute inset-[2px] rounded-md" style={{ background: cardBg }} />
      </span>
    );
  };

  // Rozet konumu + stili panelden seçilir; mobilde başlığı kapatmaması için üstte durur.
  const badgePos =
    slot.badge_position === "left"
      ? "left-1.5 sm:left-2.5"
      : slot.badge_position === "right"
        ? "right-1.5 sm:right-2.5"
        : "left-1/2 -translate-x-1/2";
  const badgeText = "text-[9px] font-black leading-tight tracking-wide sm:text-[10px] sm:tracking-widest";

  // Köşe stili merkez seçiminde sağ köşeye yerleşir (köşe sadece sol/sağ olabilir).
  const cornerSide = slot.badge_position === "left" ? "left" : "right";

  const renderBadge = () => {
    if (!slot.badge) return null;
    const colors = { background: badgeBg, color: badgeFg };

    if (slot.badge_style === "strip") {
      return (
        <span
          className={`absolute left-0 right-0 top-0 z-10 px-2 py-0.5 ${badgeText} ${
            slot.badge_position === "left"
              ? "text-left"
              : slot.badge_position === "right"
                ? "text-right"
                : "text-center"
          }`}
          style={colors}
          data-testid="ad-card-badge"
        >
          {slot.badge}
        </span>
      );
    }

    if (slot.badge_style === "corner") {
      // Çapraz bar köşeyi kartın İÇİNDE keser; mobilde dar kartlar için daha küçük.
      return (
        <span
          className={`absolute top-[7px] z-10 w-[74px] py-px text-center sm:top-[14px] sm:w-[110px] sm:py-0.5 ${badgeText} ${
            cornerSide === "left"
              ? "left-[-24px] -rotate-45 sm:left-[-33px]"
              : "right-[-24px] rotate-45 sm:right-[-33px]"
          }`}
          style={colors}
          data-testid="ad-card-badge"
        >
          {slot.badge}
        </span>
      );
    }

    if (slot.badge_style === "ribbon") {
      return (
        <span
          className={`absolute top-0 z-10 px-2.5 pb-1.5 pt-0.5 ${badgeText} ${badgePos}`}
          style={{ ...colors, clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 62%, 0 100%)" }}
          data-testid="ad-card-badge"
        >
          {slot.badge}
        </span>
      );
    }

    // tab (varsayılan)
    return (
      <span
        className={`absolute top-0 z-10 rounded-b px-1.5 py-px sm:px-2 sm:py-0.5 ${badgeText} ${badgePos}`}
        style={colors}
        data-testid="ad-card-badge"
      >
        {slot.badge}
      </span>
    );
  };

  if (slot.type === "html") {
    return (
      <article
        className={`overflow-hidden rounded-lg border ${span} ${heightCls}`}
        style={{ ...heightVar, background: cardBg, borderColor: `${color}59` }}
        data-testid="ad-card-item"
      >
        <div
          className="h-full w-full"
          data-testid="ad-card-html"
          dangerouslySetInnerHTML={{ __html: slot.html }}
        />
      </article>
    );
  }

  return (
    <article
      className={`group relative cursor-pointer overflow-hidden rounded-md border transition-all duration-200 ease-out hover:-translate-y-0.5 sm:rounded-lg ${span} ${heightCls}`}
      style={{
        ...heightVar,
        background: cardBg,
        borderColor: `${color}66`,
        boxShadow: `inset 0 0 34px -14px ${color}, 0 0 0 0 transparent`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `inset 0 0 34px -12px ${color}, 0 0 22px -6px ${color}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${color}66`;
        e.currentTarget.style.boxShadow = `inset 0 0 34px -14px ${color}, 0 0 0 0 transparent`;
      }}
      data-testid="ad-card-item"
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => e.key === "Enter" && go()}
    >
      {/* corner brackets */}
      {[
        "left-1 top-1 border-l-2 border-t-2 sm:left-2 sm:top-2",
        "right-1 top-1 border-r-2 border-t-2 sm:right-2 sm:top-2",
        "left-1 bottom-1 border-b-2 border-l-2 sm:left-2 sm:bottom-2",
        "right-1 bottom-1 border-b-2 border-r-2 sm:right-2 sm:bottom-2",
      ].map((cls) => (
        <span
          key={cls}
          className={`pointer-events-none absolute h-2 w-2 sm:h-3.5 sm:w-3.5 ${cls}`}
          style={{ borderColor: color }}
        />
      ))}

      {renderEffect()}
      {renderBadge()}

      <div
        className={`relative z-[1] flex h-full flex-col items-center justify-center gap-1 px-2 text-center sm:gap-2 sm:px-5 sm:py-6 ${
          slot.badge
            ? slot.badge_style === "ribbon"
              ? "pb-2 pt-7 sm:pt-8"
              : slot.badge_style === "corner"
                ? "pb-2 pt-6 sm:pt-6"
                : "pb-2 pt-5 sm:pt-6"
            : "py-3"
        }`}
      >
        {slot.type === "image" && slot.image_url ? (
          <img
            src={slot.image_url}
            alt={slot.title}
            className="mb-0.5 max-h-5 w-auto max-w-[85%] object-contain transition-transform duration-200 group-hover:scale-105 sm:mb-1 sm:max-h-9 sm:max-w-[70%]"
            data-testid="ad-card-logo"
          />
        ) : null}

        <h3
          className={`font-heading font-black uppercase leading-tight tracking-tight ${sizeCls.title}`}
          style={{ color: slot.type === "image" && slot.image_url ? "#FFFFFF" : color }}
          data-testid="ad-card-title"
        >
          {slot.title}
        </h3>

        {slot.description ? (
          <p
            className={`font-bold uppercase leading-snug tracking-tight text-slate-100 sm:tracking-wide ${sizeCls.line}`}
            data-testid="ad-card-line1"
          >
            {slot.description}
          </p>
        ) : null}
        {slot.line2 ? (
          <p
            className={`font-bold uppercase leading-snug tracking-tight sm:tracking-wide ${sizeCls.line}`}
            style={{ color }}
            data-testid="ad-card-line2"
          >
            {slot.line2}
          </p>
        ) : null}

        {slot.type === "cta" && slot.cta_text ? (
          <span
            className="mt-1 rounded px-2.5 py-1 text-[10px] font-black tracking-wide transition-transform duration-150 group-hover:scale-105 sm:mt-2 sm:px-4 sm:py-1.5 sm:text-[11px] sm:tracking-widest"
            style={{ background: color, color: "#000" }}
          >
            {slot.cta_text}
          </span>
        ) : null}
      </div>
    </article>
  );
}
