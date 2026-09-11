import type { AdSlot } from "@/lib/types";
import { apiPost } from "@/lib/api";
import { ArrowUpRight } from "lucide-react";

interface Props {
  slot: AdSlot;
  accent: string;
  accent2: string;
  cardBg: string;
}

const SPAN: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
};

export default function AdSlotRenderer({ slot, accent, accent2, cardBg }: Props) {
  const go = () => {
    void apiPost(`/public/slots/${slot.id}/click`).catch(() => undefined);
    if (slot.target_url) window.open(slot.target_url, "_blank", "noopener");
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-white/10 transition-all duration-200 ease-out hover:-translate-y-1 ${SPAN[slot.col_span] ?? "md:col-span-1"}`}
      style={{ background: cardBg, minHeight: slot.height }}
      data-testid="ad-card-item"
      onClick={slot.type === "html" ? undefined : go}
      role={slot.type === "html" ? undefined : "link"}
      tabIndex={slot.type === "html" ? undefined : 0}
      onKeyDown={(e) => {
        if (slot.type !== "html" && e.key === "Enter") go();
      }}
    >
      {slot.badge ? (
        <span
          className="absolute left-3 top-3 z-10 rounded px-2 py-0.5 text-[10px] font-bold tracking-widest"
          style={{ background: accent, color: "#000" }}
          data-testid="ad-card-badge"
        >
          {slot.badge}
        </span>
      ) : null}

      {slot.type === "image" ? (
        <div className="relative h-full w-full cursor-pointer" style={{ minHeight: slot.height }}>
          <img
            src={slot.image_url}
            alt={slot.title}
            className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity duration-200 group-hover:opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-heading text-lg font-bold tracking-tight text-white" data-testid="ad-card-title">
              {slot.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-300">{slot.description}</p>
            <span
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold tracking-wide"
              style={{ color: accent2 }}
            >
              GİRİŞ YAP <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      ) : null}

      {slot.type === "cta" ? (
        <div
          className="flex h-full cursor-pointer flex-col justify-center gap-3 p-6"
          style={{ minHeight: slot.height }}
        >
          <h3 className="font-heading text-2xl font-extrabold tracking-tight" style={{ color: accent }} data-testid="ad-card-title">
            {slot.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{slot.description}</p>
          <span
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-extrabold tracking-wide transition-transform duration-150 group-hover:scale-[1.03]"
            style={{ background: accent, color: "#000" }}
          >
            {slot.cta_text || "HEMEN AL"} <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      ) : null}

      {slot.type === "html" ? (
        <div
          className="h-full w-full"
          style={{ minHeight: slot.height }}
          data-testid="ad-card-html"
          dangerouslySetInnerHTML={{ __html: slot.html }}
        />
      ) : null}
    </article>
  );
}
