import type { AdSlot } from "@/lib/types";
import { apiPost } from "@/lib/api";

interface Props {
  slot: AdSlot;
  accent: string;
  cardBg: string;
}

const SPAN: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
};

/** tuna40-style brand card: dark plate, neon border, corner brackets, logo + two bonus lines. */
export default function AdSlotRenderer({ slot, accent, cardBg }: Props) {
  const color = slot.border_color || accent;

  const go = () => {
    void apiPost(`/public/slots/${slot.id}/click`).catch(() => undefined);
    if (slot.target_url) window.open(slot.target_url, "_blank", "noopener");
  };

  const span = SPAN[slot.col_span] ?? "sm:col-span-1";

  if (slot.type === "html") {
    return (
      <article
        className={`overflow-hidden rounded-lg border ${span}`}
        style={{ background: cardBg, borderColor: `${color}59`, minHeight: slot.height }}
        data-testid="ad-card-item"
      >
        <div
          className="h-full w-full"
          style={{ minHeight: slot.height }}
          data-testid="ad-card-html"
          dangerouslySetInnerHTML={{ __html: slot.html }}
        />
      </article>
    );
  }

  return (
    <article
      className={`group relative cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 ease-out hover:-translate-y-0.5 ${span}`}
      style={{
        background: cardBg,
        borderColor: `${color}66`,
        minHeight: slot.height,
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
        "left-2 top-2 border-l-2 border-t-2",
        "right-2 top-2 border-r-2 border-t-2",
        "left-2 bottom-2 border-b-2 border-l-2",
        "right-2 bottom-2 border-b-2 border-r-2",
      ].map((cls) => (
        <span key={cls} className={`pointer-events-none absolute h-3.5 w-3.5 ${cls}`} style={{ borderColor: color }} />
      ))}

      {slot.badge ? (
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b px-2 py-0.5 text-[9px] font-black tracking-widest"
          style={{ background: color, color: "#000" }}
          data-testid="ad-card-badge"
        >
          {slot.badge}
        </span>
      ) : null}

      <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-6 text-center" style={{ minHeight: slot.height }}>
        {slot.type === "image" && slot.image_url ? (
          <img
            src={slot.image_url}
            alt={slot.title}
            className="mb-1 max-h-9 w-auto max-w-[70%] object-contain transition-transform duration-200 group-hover:scale-105"
            data-testid="ad-card-logo"
          />
        ) : null}

        <h3
          className="font-heading text-xl font-black uppercase leading-none tracking-tight"
          style={{ color: slot.type === "image" && slot.image_url ? "#FFFFFF" : color }}
          data-testid="ad-card-title"
        >
          {slot.title}
        </h3>

        {slot.description ? (
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-200" data-testid="ad-card-line1">
            {slot.description}
          </p>
        ) : null}
        {slot.line2 ? (
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }} data-testid="ad-card-line2">
            {slot.line2}
          </p>
        ) : null}

        {slot.type === "cta" && slot.cta_text ? (
          <span
            className="mt-2 rounded px-4 py-1.5 text-[11px] font-black tracking-widest transition-transform duration-150 group-hover:scale-105"
            style={{ background: color, color: "#000" }}
          >
            {slot.cta_text}
          </span>
        ) : null}
      </div>
    </article>
  );
}
